/**
 * GitHub Sync Service for OCMS.
 *
 * Step-by-step logic:
 * 1. Authenticate with user's access_token from the Account model via Octokit
 * 2. Fetch the target file content from the repository
 * 3. Apply text replacements (regex-based: old value → new value)
 * 4. Commit and push the updated file to the specified branch
 */

import { Octokit } from "@octokit/rest";
import { prisma } from "@/lib/prisma";
import type { SchemaField } from "@/lib/gemini";

export interface SyncInput {
    userId: string;
    projectId: string;
    updates: Array<{
        id: string;
        oldValue: string;
        newValue: string;
    }>;
    commitMessage?: string;
}

export interface SyncResult {
    success: boolean;
    commitSha?: string;
    commitUrl?: string;
    filesChanged: number;
    error?: string;
}

/**
 * Retrieves the user's GitHub access token from the Account model.
 */
async function getAccessToken(userId: string): Promise<string> {
    const account = await prisma.account.findFirst({
        where: {
            userId,
            provider: "github",
        },
        select: { access_token: true },
    });

    if (!account?.access_token) {
        throw new Error(
            "No GitHub access token found. Please re-authenticate with the `repo` scope."
        );
    }

    return account.access_token;
}

/**
 * Fetches a file from a GitHub repository.
 * Returns the file content (decoded from base64) and its SHA for committing.
 */
async function getFileFromRepo(
    octokit: Octokit,
    owner: string,
    repo: string,
    path: string,
    branch: string
): Promise<{ content: string; sha: string }> {
    const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
    });

    if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
        throw new Error(`Path "${path}" is not a file`);
    }

    const content = Buffer.from(data.content, "base64").toString("utf-8");
    return { content, sha: data.sha };
}

/**
 * Applies regex-based text replacements to file content.
 *
 * Strategy:
 * - For each update, escape special regex characters in the old value
 * - Use a global regex to replace ALL occurrences
 * - Track how many replacements were made
 */
function applyReplacements(
    content: string,
    updates: SyncInput["updates"]
): { newContent: string; replacementsMade: number } {
    let newContent = content;
    let replacementsMade = 0;

    for (const update of updates) {
        if (update.oldValue === update.newValue) continue;

        // Escape special regex characters in the old value
        const escaped = update.oldValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escaped, "g");
        const matches = newContent.match(regex);

        if (matches) {
            replacementsMade += matches.length;
            newContent = newContent.replace(regex, update.newValue);
        }
    }

    return { newContent, replacementsMade };
}

/**
 * Main sync function — orchestrates the full GitHub commit flow.
 */
export async function syncToGitHub(input: SyncInput): Promise<SyncResult> {
    try {
        // 1. Get project data
        const project = await prisma.project.findUnique({
            where: { id: input.projectId },
            select: {
                githubOwner: true,
                githubRepo: true,
                githubBranch: true,
                targetFilePath: true,
                generatedSchema: true,
            },
        });

        if (!project) {
            return { success: false, filesChanged: 0, error: "Project not found" };
        }

        if (!project.githubOwner || !project.githubRepo || !project.targetFilePath) {
            return {
                success: false,
                filesChanged: 0,
                error: "Project is missing GitHub configuration (owner, repo, or file path)",
            };
        }

        // 2. Authenticate with Octokit
        const accessToken = await getAccessToken(input.userId);
        const octokit = new Octokit({ auth: accessToken });

        // 3. Fetch current file
        const { content, sha } = await getFileFromRepo(
            octokit,
            project.githubOwner,
            project.githubRepo,
            project.targetFilePath,
            project.githubBranch
        );

        // 4. Apply replacements
        const { newContent, replacementsMade } = applyReplacements(
            content,
            input.updates
        );

        if (replacementsMade === 0) {
            return {
                success: true,
                filesChanged: 0,
                error: "No matching text found to replace",
            };
        }

        // 5. Commit and push
        const commitMsg =
            input.commitMessage || `chore(ocms): update ${replacementsMade} content field(s)`;

        const { data: commitData } = await octokit.repos.createOrUpdateFileContents(
            {
                owner: project.githubOwner,
                repo: project.githubRepo,
                path: project.targetFilePath,
                message: commitMsg,
                content: Buffer.from(newContent, "utf-8").toString("base64"),
                sha,
                branch: project.githubBranch,
            }
        );

        // 6. Update the project's schema with the new values
        const currentSchema = ((project.generatedSchema as unknown) as SchemaField[]) || [];
        const updatedSchema = currentSchema.map((field) => {
            const update = input.updates.find((u) => u.id === field.id);
            if (update) {
                return { ...field, value: update.newValue };
            }
            return field;
        });

        await prisma.project.update({
            where: { id: input.projectId },
            data: { generatedSchema: updatedSchema as unknown as object },
        });

        return {
            success: true,
            commitSha: commitData.commit.sha,
            commitUrl: commitData.commit.html_url ?? undefined,
            filesChanged: 1,
        };
    } catch (err) {
        const message =
            err instanceof Error ? err.message : "GitHub sync failed";
        return { success: false, filesChanged: 0, error: message };
    }
}
