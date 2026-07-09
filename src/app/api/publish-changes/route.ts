import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedUser } from "@/auth";
import { prisma } from "@/lib/prisma";
import { patchJSXWithReport, type ASTChange, type PatchReport } from "@/lib/ast-patcher";
import { patchHTMLWithReport } from "@/lib/html-patcher";
import { normalizeChanges } from "@/lib/publish-change-normalizer";
import { Octokit } from "@octokit/rest";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/** Allowlist of safe characters for repo owner / repo name */
const SAFE_REPO_SEGMENT = /^[a-zA-Z0-9_.\-]+$/;

/** Validate that a path does not contain traversal sequences */
function isPathSafe(filePath: string): boolean {
    if (!filePath || typeof filePath !== "string") return false;
    const normalized = path.normalize(filePath);
    // Block absolute paths and traversal
    if (path.isAbsolute(normalized)) return false;
    if (normalized.startsWith("..")) return false;
    if (normalized.includes("..")) return false;
    return true;
}

export async function POST(req: NextRequest) {
    try {
        // Authenticate user first
        const userId = await getAuthorizedUser();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { projectId, repoOwner, repoName, filePath, changes } = await req.json();

        // ── Input validation ──
        if (!repoOwner || !repoName || !filePath || !changes || !Array.isArray(changes)) {
            return patchJson({ error: "Missing required fields: repoOwner, repoName, filePath, changes" }, { status: 400 });
        }

        // Validate repo owner and repo name (prevent path injection)
        if (!SAFE_REPO_SEGMENT.test(repoOwner)) {
            return patchJson({ error: "Invalid repoOwner format" }, { status: 400 });
        }
        if (!SAFE_REPO_SEGMENT.test(repoName)) {
            return patchJson({ error: "Invalid repoName format" }, { status: 400 });
        }

        // Validate file path (no traversal, no absolute paths)
        if (!isPathSafe(filePath)) {
            return patchJson({ error: "Invalid or unsafe filePath" }, { status: 400 });
        }

        const astChanges = normalizeChanges(changes);
        if (!astChanges.length) {
            return patchJson({ error: "No patchable changes were provided" }, { status: 400 });
        }

        // Look up the project to get authoritative repo values
        const project = projectId
            ? await prisma.project.findFirst({
                where: { id: projectId, userId },
                select: {
                    githubOwner: true,
                    githubRepo: true,
                    githubBranch: true,
                    targetFilePath: true,
                    name: true,
                },
            })
            : null;

        if (projectId && !project) {
            return patchJson({ error: "Project not found" }, { status: 404 });
        }

        // Prefer project DB values; fall back to request body (for projects without GitHub config)
        const targetOwner = project?.githubOwner || repoOwner;
        const targetRepo = project?.githubRepo || repoName;
        const targetPath = project?.targetFilePath || filePath;
        const targetBranch = project?.githubBranch || "main";
        const projectName = project?.name || "OCMS Project";

        // Fetch GitHub access token from the Account table
        const account = await prisma.account.findFirst({
            where: {
                userId: userId,
                provider: "github",
            },
        });

        // ── No GitHub account: demo/offline mode ──
        if (!account || !account.access_token) {
            return patchJson({
                demoMode: true,
                success: false,
                message: "No GitHub account connected. Sign in with GitHub to push changes to a repository.",
                hint: "Use the GitHub Setup Assistant in the toolbar to connect your account.",
            }, { status: 200 });
        }

        // ── Local filesystem mode (mock_token = dev mode) ──
        if (account.access_token === "mock_token") {
            // Block local writes in production
            if (process.env.NODE_ENV === "production") {
                return patchJson({
                    error: "Local filesystem sync is not available in production. Connect a real GitHub account.",
                }, { status: 403 });
            }

            const localWorkspacePath = process.env.LOCAL_WORKSPACE_PATH;
            if (!localWorkspacePath) {
                return patchJson({
                    error: "LOCAL_WORKSPACE_PATH is not set. Set it in your .env.local to enable local file sync.",
                }, { status: 400 });
            }

            try {
                const localRoot = path.resolve(localWorkspacePath);
                const localFilePath = path.resolve(localRoot, targetPath);
                const insideLocalRoot = localFilePath === localRoot || localFilePath.startsWith(`${localRoot}${path.sep}`);

                if (!insideLocalRoot) {
                    return patchJson({ error: `Path traversal blocked: ${targetPath}` }, { status: 403 });
                }
                if (!fs.existsSync(localFilePath)) {
                    return patchJson({ error: `Local file not found: ${targetPath}` }, { status: 404 });
                }

                const localContent = fs.readFileSync(localFilePath, "utf8");
                const patchResult = patchSource(localContent, targetPath, astChanges);

                if (patchResult.appliedCount === 0) {
                    return noPatchResponse(patchResult);
                }

                if (patchResult.code === localContent) {
                    return patchJson({
                        success: true,
                        message: "Selectors matched but no source changes were necessary (values already match).",
                        commitUrl: "#",
                        unchanged: true,
                    }, { status: 200 }, patchResult);
                }

                fs.writeFileSync(localFilePath, patchResult.code, "utf8");
                console.log(`[Local Sync] Updated: ${localFilePath}`);

                return patchJson({
                    success: true,
                    message: buildCommitMessage(patchResult, "Local file updated (Dev Mode).", astChanges, projectName, targetPath),
                    commitUrl: "#",
                    devMode: true,
                }, { status: 200 }, patchResult);
            } catch (err) {
                console.error("Local sync error:", err);
                return patchJson({
                    error: `Local sync failed: ${err instanceof Error ? err.message : String(err)}`,
                }, { status: 500 });
            }
        }

        // ── Real GitHub push ──
        const octokit = new Octokit({ auth: account.access_token });

        // STEP 1: Fetch file from GitHub
        let fileData;
        try {
            const { data } = await octokit.repos.getContent({
                owner: targetOwner,
                repo: targetRepo,
                path: targetPath,
                ref: targetBranch,
            });
            fileData = data;
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            return patchJson({
                error: `Failed to fetch file from GitHub: ${errorMessage}. Check that the repo, owner, and file path are correct.`,
            }, { status: 404 });
        }

        if (Array.isArray(fileData) || fileData.type !== "file") {
            return patchJson({ error: "Target path points to a directory, not a file" }, { status: 400 });
        }

        const fileSha = fileData.sha;
        const decodedContent = Buffer.from(fileData.content, "base64").toString("utf8");

        // STEP 2: Apply changes via AST patcher
        const patchResult = patchSource(decodedContent, targetPath, astChanges);

        if (patchResult.appliedCount === 0) {
            return noPatchResponse(patchResult);
        }

        if (patchResult.code === decodedContent) {
            return NextResponse.json({
                success: true,
                message: "Selectors matched but no source changes were necessary (values already match).",
                commitUrl: "#",
                unchanged: true,
                matchedSelectors: patchResult.matchedSelectors,
                appliedCount: patchResult.appliedCount,
                unmatchedSelectors: patchResult.unmatchedSelectors,
            }, { status: 200 });
        }

        // STEP 3: Local workspace sync (best-effort, non-blocking)
        const localWorkspacePath = process.env.LOCAL_WORKSPACE_PATH;
        if (localWorkspacePath) {
            try {
                const localRoot = path.resolve(localWorkspacePath);
                const localFilePath = path.resolve(localRoot, targetPath);
                const insideLocalRoot = localFilePath === localRoot || localFilePath.startsWith(`${localRoot}${path.sep}`);

                if (insideLocalRoot && fs.existsSync(localFilePath)) {
                    fs.writeFileSync(localFilePath, patchResult.code, "utf8");
                    console.log(`[Local Sync] Mirrored to: ${localFilePath}`);
                } else if (!insideLocalRoot) {
                    console.warn(`[Local Sync] Blocked path traversal attempt: ${localFilePath}`);
                }
            } catch (localErr) {
                console.error("[Local Sync Error]:", localErr);
                // Non-fatal — the GitHub push will still proceed
            }
        }

        // STEP 4: Push to GitHub with a descriptive commit message
        const commitMessage = buildCommitMessage(patchResult, "", astChanges, projectName, targetPath);
        const encodedContent = Buffer.from(patchResult.code).toString("base64");

        let updateResult;
        try {
            const { data } = await octokit.repos.createOrUpdateFileContents({
                owner: targetOwner,
                repo: targetRepo,
                path: targetPath,
                message: commitMessage,
                content: encodedContent,
                sha: fileSha,
                branch: targetBranch,
            });
            updateResult = data;
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            // Detect SHA conflict (409 from GitHub means the file was modified between our read and write)
            if (errMsg.includes("409") || errMsg.toLowerCase().includes("conflict") || errMsg.toLowerCase().includes("sha")) {
                return patchJson({
                    error: "Conflict detected: the file was modified on GitHub since you last loaded it. Please reload the workspace and try again.",
                    conflict: true,
                }, { status: 409 });
            }
            return patchJson({ error: `GitHub push failed: ${errMsg}` }, { status: 500 });
        }

        return patchJson({
            success: true,
            message: buildCommitMessage(patchResult, `Pushed to branch "${targetBranch}" successfully.`, astChanges, projectName, targetPath),
            commitUrl: updateResult.commit.html_url,
        }, { status: 200 }, patchResult);

    } catch (error: unknown) {
        console.error("Publish changes error:", error);
        // Safe error: don't leak internal details to clients
        return patchJson({ error: "An unexpected error occurred. Please try again." }, { status: 500 });
    }
}

function patchSource(sourceCode: string, filePath: string, changes: ASTChange[]): PatchReport {
    return filePath.toLowerCase().endsWith(".html")
        ? patchHTMLWithReport(sourceCode, changes)
        : patchJSXWithReport(sourceCode, changes);
}

function noPatchResponse(report: PatchReport) {
    return patchJson({
        error: "No matching nodes were found for the provided selectors. The page structure may have changed — try rescanning.",
        hint: "Tip: rescan the page to regenerate selectors, then try again.",
    }, { status: 422 }, report);
}

/** Build a descriptive commit message including field names and file path */
function buildCommitMessage(
    report: PatchReport,
    suffix: string,
    changes: ASTChange[],
    projectName: string,
    filePath: string
): string {
    const fieldNames = changes
        .slice(0, 3)
        .map(c => c.selector)
        .filter(Boolean)
        .join(", ");
    const more = changes.length > 3 ? ` (+${changes.length - 3} more)` : "";
    const fieldSummary = fieldNames ? ` [${fieldNames}${more}]` : "";
    const unmatchedNote = report.unmatchedSelectors.length > 0
        ? ` (${report.unmatchedSelectors.length} selector(s) unmatched)`
        : "";
    const base = `OCMS: Update ${report.appliedCount} field(s) in ${filePath}${fieldSummary}${unmatchedNote}`;
    return suffix ? `${base} — ${suffix}` : base;
}

function patchJson(
    body: Record<string, unknown>,
    init: { status: number },
    report?: Pick<PatchReport, "appliedCount" | "matchedSelectors" | "unmatchedSelectors">
) {
    return NextResponse.json({
        appliedCount: report?.appliedCount ?? 0,
        matchedSelectors: report?.matchedSelectors ?? [],
        unmatchedSelectors: report?.unmatchedSelectors ?? [],
        ...body,
    }, init);
}
