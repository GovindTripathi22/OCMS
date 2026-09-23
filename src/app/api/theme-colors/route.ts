import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, requireOwnedProject } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { Octokit } from "@octokit/rest";
import { validateMutationOrigin } from "@/lib/csrf";
import { createErrorResponse, parseJsonSafely, safePathInsideRoot, validateHexColor, LIMITS } from "@/lib/validation";
import fs from "fs/promises";
import path from "path";

import { patchCssWithThemeColors } from "@/lib/theme-css-patcher";

interface ThemeColorsRequestBody {
    projectId: string;
    colors: string[];
    cssFilePath?: string;
}

export async function POST(req: NextRequest) {
    const csrfError = validateMutationOrigin(req);
    if (csrfError) return csrfError;

    const authCheck = await requireAuthenticatedUser();
    if (authCheck.error) {
        return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
    }
    const userId = authCheck.userId;

    const { data, error: jsonError } = await parseJsonSafely<ThemeColorsRequestBody>(req, 10 * 1024);
    if (jsonError) return jsonError;

    const projectId = data?.projectId?.trim();
    const colors = data?.colors;
    const requestedCssPath = data?.cssFilePath?.trim();

    if (!projectId || !Array.isArray(colors) || colors.length !== 5) {
        return createErrorResponse(
            "INVALID_INPUT",
            "Required: projectId and colors (array of exactly 5 hex colors)",
            400
        );
    }

    // Validate each color strictly
    for (let i = 0; i < 5; i++) {
        if (!validateHexColor(colors[i])) {
            return createErrorResponse(
                "INVALID_COLOR",
                `Color at index ${i} ("${colors[i]}") is not a valid hex color (e.g. #FFFFFF or #fff)`,
                400
            );
        }
    }

    // Authoritative derivation: Project must exist and belong to the user
    const projectCheck = await requireOwnedProject(projectId, userId);
    if (projectCheck.error) {
        return createErrorResponse(projectCheck.error.code, projectCheck.error.message, projectCheck.error.status);
    }
    const project = projectCheck.project;

    // Use derived target path, rejecting directory traversal
    const rawTarget = requestedCssPath || "src/app/globals.css";
    if (rawTarget.length > LIMITS.CSS_PATH_MAX_LENGTH) {
        return createErrorResponse("INVALID_PATH", "cssFilePath exceeds maximum length", 400);
    }

    const targetPath = path.normalize(rawTarget);
    if (!targetPath.toLowerCase().endsWith(".css")) {
        return createErrorResponse("INVALID_PATH", "Only .css files may be targeted for theme colors", 400);
    }
    if (targetPath.startsWith("..") || path.isAbsolute(rawTarget) || rawTarget.includes("../") || rawTarget.includes("..\\")) {
        return createErrorResponse("PATH_TRAVERSAL_BLOCKED", `Access denied to path: ${rawTarget}`, 403);
    }

    // Check for GitHub access token
    const account = await prisma.account.findFirst({
        where: { userId, provider: "github" },
    });

    const isGithubConfigured = Boolean(
        account?.access_token &&
        account.access_token !== "mock_token" &&
        project.githubOwner &&
        project.githubRepo
    );

    // If GitHub is not configured or in mock/local mode, write to local workspace
    if (!isGithubConfigured) {
        if (process.env.NODE_ENV === "production") {
            return createErrorResponse(
                "GITHUB_REQUIRED",
                "Local filesystem sync is not available in production. Connect a real GitHub account.",
                403
            );
        }

        const localWorkspacePath = process.env.LOCAL_WORKSPACE_PATH || process.cwd();
        const safeCssPath = safePathInsideRoot(localWorkspacePath, targetPath);

        if (!safeCssPath) {
            return createErrorResponse("PATH_TRAVERSAL_BLOCKED", `Access denied to path: ${targetPath}`, 403);
        }

        try {
            let currentCss = "";
            try {
                currentCss = await fs.readFile(safeCssPath, "utf-8");
            } catch {
                // File does not exist yet; start with empty stylesheet
                currentCss = "";
            }

            const updatedCss = patchCssWithThemeColors(currentCss, colors);
            await fs.mkdir(path.dirname(safeCssPath), { recursive: true });
            await fs.writeFile(safeCssPath, updatedCss, "utf-8");

            // Verify the file was actually updated on disk
            const readBack = await fs.readFile(safeCssPath, "utf-8");
            if (readBack !== updatedCss) {
                return createErrorResponse("WRITE_VERIFICATION_FAILED", "Failed to verify updated CSS file on disk", 500);
            }

            return NextResponse.json({
                success: true,
                message: `Theme colors updated in local workspace: ${targetPath}`,
                colors,
                localSynced: true,
                githubSynced: false,
            });
        } catch (fsErr) {
            console.error("[Theme Colors Local Write Error]:", fsErr);
            return createErrorResponse("LOCAL_WRITE_FAILED", "Failed to update theme colors on local filesystem", 500);
        }
    }

    // GitHub Push Flow
    const octokit = new Octokit({ auth: account!.access_token! });
    const repoOwner = project.githubOwner!;
    const repoName = project.githubRepo!;
    const repoBranch = project.githubBranch || "main";

    let fileData;
    try {
        const { data } = await octokit.repos.getContent({
            owner: repoOwner,
            repo: repoName,
            path: targetPath,
            ref: repoBranch,
        });
        fileData = data;
    } catch {
        return createErrorResponse(
            "FILE_NOT_FOUND",
            `Could not find ${targetPath} in repository ${repoOwner}/${repoName} on branch ${repoBranch}`,
            404
        );
    }

    if (Array.isArray(fileData) || fileData.type !== "file" || !("content" in fileData)) {
        return createErrorResponse("TARGET_NOT_A_FILE", "Target path is a directory, not a CSS file", 400);
    }

    const fileSha = fileData.sha;
    const currentCss = Buffer.from(fileData.content, "base64").toString("utf-8");
    const updatedCss = patchCssWithThemeColors(currentCss, colors);
    const encodedContent = Buffer.from(updatedCss).toString("base64");

    try {
        const { data: updateResult } = await octokit.repos.createOrUpdateFileContents({
            owner: repoOwner,
            repo: repoName,
            path: targetPath,
            branch: repoBranch,
            message: `OCMS: Update theme colors — ${colors.join(", ")}`,
            content: encodedContent,
            sha: fileSha,
        });

        return NextResponse.json({
            success: true,
            message: "Theme colors pushed to GitHub successfully",
            colors,
            commitUrl: updateResult.commit.html_url,
            localSynced: false,
            githubSynced: true,
        });
    } catch (githubErr: unknown) {
        console.error("[GitHub Theme Colors Push Error]:", githubErr);
        const msg = githubErr instanceof Error ? githubErr.message : "GitHub commit failed";
        return createErrorResponse("GITHUB_PUSH_FAILED", msg, 500);
    }
}
