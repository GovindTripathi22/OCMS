import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedUser } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireOwnedProject } from "@/lib/auth-guards";
import { patchJSXWithReport, type ASTChange, type PatchReport } from "@/lib/ast-patcher";
import { patchHTMLWithReport } from "@/lib/html-patcher";
import { normalizeChanges } from "@/lib/publish-change-normalizer";
import { Octokit } from "@octokit/rest";
import fs from "fs";
import path from "path";
import crypto from "crypto";

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

/**
 * Atomically writes content to a target file by writing to a temporary file,
 * verifying its content, and renaming it to the target.
 */
function atomicWriteFile(targetFilePath: string, content: string): void {
    const dir = path.dirname(targetFilePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const tempFilePath = path.join(
        dir,
        `.${path.basename(targetFilePath)}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
    );
    try {
        fs.writeFileSync(tempFilePath, content, "utf8");
        const verified = fs.readFileSync(tempFilePath, "utf8");
        if (verified !== content) {
            throw new Error("Atomic write verification failed: read content did not match written content");
        }
        fs.renameSync(tempFilePath, targetFilePath);
    } catch (err) {
        try {
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        } catch {}
        throw err;
    }
}

export async function POST(req: NextRequest) {
    try {
        // Authenticate user first
        const userId = await getAuthorizedUser();
        if (!userId) {
            return NextResponse.json({
                success: false,
                localSynced: false,
                githubSynced: false,
                validationPassed: false,
                commitUrl: null,
                conflicts: false,
                errors: ["Unauthorized"],
                error: "Unauthorized",
            }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const { projectId, repoOwner, repoName, filePath, changes, baseSha, baseHash } = body;

        // Require project ownership
        if (!projectId) {
            return patchJson({
                success: false,
                localSynced: false,
                githubSynced: false,
                validationPassed: false,
                commitUrl: null,
                conflicts: false,
                errors: ["projectId is required"],
                error: "projectId is required",
            }, { status: 400 });
        }

        const projectCheck = await requireOwnedProject(projectId, userId);
        if (projectCheck.error) {
            return patchJson({
                success: false,
                localSynced: false,
                githubSynced: false,
                validationPassed: false,
                commitUrl: null,
                conflicts: false,
                errors: [projectCheck.error.message],
                error: projectCheck.error.message,
            }, { status: projectCheck.error.status });
        }
        const project = projectCheck.project;

        // Prefer project DB values; fall back to request body
        const targetOwner = project.githubOwner || repoOwner;
        const targetRepo = project.githubRepo || repoName;
        const targetPath = project.targetFilePath || filePath;
        const targetBranch = project.githubBranch || "main";
        const projectName = project.name || "OCMS Project";

        // Input validation
        if (!targetPath || !changes || !Array.isArray(changes)) {
            return patchJson({
                success: false,
                localSynced: false,
                githubSynced: false,
                validationPassed: false,
                commitUrl: null,
                conflicts: false,
                errors: ["Missing required fields: filePath, changes"],
                error: "Missing required fields: filePath, changes",
            }, { status: 400 });
        }

        if (!targetOwner || !targetRepo) {
            return patchJson({
                success: false,
                localSynced: false,
                githubSynced: false,
                validationPassed: false,
                commitUrl: null,
                conflicts: false,
                errors: ["Repository owner and repository name are required. Configure GitHub settings in project."],
                error: "Missing required fields: repoOwner, repoName",
            }, { status: 400 });
        }

        // Validate repo owner and repo name (prevent path injection)
        if (!SAFE_REPO_SEGMENT.test(targetOwner)) {
            return patchJson({
                success: false,
                localSynced: false,
                githubSynced: false,
                validationPassed: false,
                commitUrl: null,
                conflicts: false,
                errors: ["Invalid repoOwner format"],
                error: "Invalid repoOwner format",
            }, { status: 400 });
        }
        if (!SAFE_REPO_SEGMENT.test(targetRepo)) {
            return patchJson({
                success: false,
                localSynced: false,
                githubSynced: false,
                validationPassed: false,
                commitUrl: null,
                conflicts: false,
                errors: ["Invalid repoName format"],
                error: "Invalid repoName format",
            }, { status: 400 });
        }

        // Validate file path (no traversal, no absolute paths)
        if (!isPathSafe(targetPath)) {
            return patchJson({
                success: false,
                localSynced: false,
                githubSynced: false,
                validationPassed: false,
                commitUrl: null,
                conflicts: false,
                errors: ["Invalid or unsafe filePath"],
                error: "Invalid or unsafe filePath",
            }, { status: 400 });
        }

        const astChanges = normalizeChanges(changes);
        if (!astChanges.length) {
            return patchJson({
                success: false,
                localSynced: false,
                githubSynced: false,
                validationPassed: false,
                commitUrl: null,
                conflicts: false,
                errors: ["No patchable changes were provided"],
                error: "No patchable changes were provided",
            }, { status: 400 });
        }

        // Fetch GitHub access token from the Account table
        const account = await prisma.account.findFirst({
            where: {
                userId: userId,
                provider: "github",
            },
        });

        // Fail-closed on missing GitHub connection (zero simulated success)
        if (!account || !account.access_token) {
            return patchJson({
                success: false,
                localSynced: false,
                githubSynced: false,
                validationPassed: true,
                commitUrl: null,
                conflicts: false,
                errors: ["No GitHub account connected. Sign in with GitHub to push changes to a repository."],
                message: "No GitHub account connected. Sign in with GitHub to push changes to a repository.",
            }, { status: 400 });
        }

        // ── Local filesystem mode (mock_token = dev mode) ──
        if (account.access_token === "mock_token") {
            // Block local writes in production
            if (process.env.NODE_ENV === "production") {
                return patchJson({
                    success: false,
                    localSynced: false,
                    githubSynced: false,
                    validationPassed: true,
                    commitUrl: null,
                    conflicts: false,
                    errors: ["Local filesystem sync is not available in production. Connect a real GitHub account."],
                    error: "Local filesystem sync is not available in production. Connect a real GitHub account.",
                }, { status: 403 });
            }

            const localWorkspacePath = process.env.LOCAL_WORKSPACE_PATH || process.cwd();

            try {
                const localRoot = path.resolve(localWorkspacePath);
                const localFilePath = path.resolve(localRoot, targetPath);
                const insideLocalRoot = localFilePath === localRoot || localFilePath.startsWith(`${localRoot}${path.sep}`);

                if (!insideLocalRoot) {
                    return patchJson({
                        success: false,
                        localSynced: false,
                        githubSynced: false,
                        validationPassed: false,
                        commitUrl: null,
                        conflicts: false,
                        errors: [`Path traversal blocked: ${targetPath}`],
                        error: `Path traversal blocked: ${targetPath}`,
                    }, { status: 403 });
                }
                if (!fs.existsSync(localFilePath)) {
                    return patchJson({
                        success: false,
                        localSynced: false,
                        githubSynced: false,
                        validationPassed: false,
                        commitUrl: null,
                        conflicts: false,
                        errors: [`Local file not found: ${targetPath}`],
                        error: `Local file not found: ${targetPath}`,
                    }, { status: 404 });
                }

                const localContent = fs.readFileSync(localFilePath, "utf8");

                // Conflict detection via baseHash
                if (baseHash) {
                    const currentHash = crypto.createHash("sha256").update(localContent).digest("hex");
                    if (baseHash !== currentHash) {
                        return patchJson({
                            success: false,
                            localSynced: false,
                            githubSynced: false,
                            validationPassed: true,
                            commitUrl: null,
                            conflicts: true,
                            errors: ["Conflict detected: local file has been modified on disk since it was loaded."],
                            error: "Conflict detected: the file was modified since you last loaded it. Please reload the workspace and try again.",
                        }, { status: 409 });
                    }
                }

                const patchResult = patchSource(localContent, targetPath, astChanges);

                if (patchResult.appliedCount === 0) {
                    return noPatchResponse(patchResult);
                }

                if (patchResult.code === localContent) {
                    return patchJson({
                        success: true,
                        localSynced: true,
                        githubSynced: false,
                        validationPassed: true,
                        commitUrl: null,
                        conflicts: false,
                        errors: [],
                        message: "Selectors matched but no source changes were necessary (values already match).",
                        unchanged: true,
                    }, { status: 200 }, patchResult);
                }

                atomicWriteFile(localFilePath, patchResult.code);
                console.log(`[Local Sync] Atomically updated: ${localFilePath}`);

                return patchJson({
                    success: true,
                    localSynced: true,
                    githubSynced: false,
                    validationPassed: true,
                    commitUrl: null,
                    conflicts: false,
                    errors: [],
                    message: buildCommitMessage(patchResult, "Local file updated atomically (Dev Mode).", astChanges, projectName, targetPath),
                }, { status: 200 }, patchResult);
            } catch (err) {
                console.error("Local sync error:", err);
                const errMsg = err instanceof Error ? err.message : String(err);
                return patchJson({
                    success: false,
                    localSynced: false,
                    githubSynced: false,
                    validationPassed: false,
                    commitUrl: null,
                    conflicts: false,
                    errors: [errMsg],
                    error: `Local sync failed: ${errMsg}`,
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
                success: false,
                localSynced: false,
                githubSynced: false,
                validationPassed: false,
                commitUrl: null,
                conflicts: false,
                errors: [`Failed to fetch file from GitHub: ${errorMessage}`],
                error: `Failed to fetch file from GitHub: ${errorMessage}. Check that the repo, owner, and file path are correct.`,
            }, { status: 404 });
        }

        if (Array.isArray(fileData) || fileData.type !== "file") {
            return patchJson({
                success: false,
                localSynced: false,
                githubSynced: false,
                validationPassed: false,
                commitUrl: null,
                conflicts: false,
                errors: ["Target path points to a directory, not a file"],
                error: "Target path points to a directory, not a file",
            }, { status: 400 });
        }

        const fileSha = fileData.sha;

        // Base SHA conflict detection
        if (baseSha && baseSha !== fileSha) {
            return patchJson({
                success: false,
                localSynced: false,
                githubSynced: false,
                validationPassed: true,
                commitUrl: null,
                conflicts: true,
                errors: ["Conflict detected: remote file SHA changed since workspace was loaded."],
                error: "Conflict detected: the file was modified on GitHub since you last loaded it. Please reload the workspace and try again.",
            }, { status: 409 });
        }

        const decodedContent = Buffer.from(fileData.content, "base64").toString("utf8");

        // STEP 2: Apply changes via AST patcher
        const patchResult = patchSource(decodedContent, targetPath, astChanges);

        if (patchResult.appliedCount === 0) {
            return noPatchResponse(patchResult);
        }

        if (patchResult.code === decodedContent) {
            return patchJson({
                success: true,
                localSynced: false,
                githubSynced: true,
                validationPassed: true,
                commitUrl: null,
                conflicts: false,
                errors: [],
                message: "Selectors matched but no source changes were necessary (values already match).",
                unchanged: true,
            }, { status: 200 }, patchResult);
        }

        // STEP 3: Local workspace sync (best-effort, atomic)
        let localSynced = false;
        const localWorkspacePath = process.env.LOCAL_WORKSPACE_PATH;
        if (localWorkspacePath) {
            try {
                const localRoot = path.resolve(localWorkspacePath);
                const localFilePath = path.resolve(localRoot, targetPath);
                const insideLocalRoot = localFilePath === localRoot || localFilePath.startsWith(`${localRoot}${path.sep}`);

                if (insideLocalRoot && fs.existsSync(localFilePath)) {
                    atomicWriteFile(localFilePath, patchResult.code);
                    localSynced = true;
                    console.log(`[Local Sync] Mirrored atomically to: ${localFilePath}`);
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

        const isDefaultBranch = targetBranch === "main" || targetBranch === "master";
        const publishBranch = isDefaultBranch ? `ocms/update-${Date.now()}` : targetBranch;

        if (isDefaultBranch) {
            try {
                const refData = await octokit.git.getRef({
                    owner: targetOwner,
                    repo: targetRepo,
                    ref: `heads/${targetBranch}`,
                });
                const baseSha = refData.data.object.sha;

                await octokit.git.createRef({
                    owner: targetOwner,
                    repo: targetRepo,
                    ref: `refs/heads/${publishBranch}`,
                    sha: baseSha,
                });
            } catch (branchErr) {
                console.warn("[GitHub Branch Create Warning]:", branchErr);
            }
        }

        let updateResult;
        try {
            const { data } = await octokit.repos.createOrUpdateFileContents({
                owner: targetOwner,
                repo: targetRepo,
                path: targetPath,
                message: commitMessage,
                content: encodedContent,
                sha: fileSha,
                branch: publishBranch,
            });
            updateResult = data;
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            // Detect SHA conflict (409 from GitHub means the file was modified between our read and write)
            if (errMsg.includes("409") || errMsg.toLowerCase().includes("conflict") || errMsg.toLowerCase().includes("sha")) {
                return patchJson({
                    success: false,
                    localSynced: false,
                    githubSynced: false,
                    validationPassed: true,
                    commitUrl: null,
                    conflicts: true,
                    errors: ["Conflict detected: the file was modified on GitHub since you last loaded it."],
                    error: "Conflict detected: the file was modified on GitHub since you last loaded it. Please reload the workspace and try again.",
                }, { status: 409 });
            }
            return patchJson({
                success: false,
                localSynced,
                githubSynced: false,
                validationPassed: false,
                commitUrl: null,
                conflicts: false,
                errors: [errMsg],
                error: `GitHub push failed: ${errMsg}`,
            }, { status: 500 });
        }

        let commitUrl = updateResult.commit.html_url;
        if (isDefaultBranch) {
            try {
                const prResult = await octokit.pulls.create({
                    owner: targetOwner,
                    repo: targetRepo,
                    title: commitMessage,
                    head: publishBranch,
                    base: targetBranch,
                    body: "Automated content update published via OCMS.",
                });
                commitUrl = prResult.data.html_url;
            } catch (prErr) {
                console.warn("[GitHub PR Create Warning]:", prErr);
            }
        }

        return patchJson({
            success: true,
            localSynced,
            githubSynced: true,
            validationPassed: true,
            commitUrl,
            errors: [],
            conflicts: false,
            message: buildCommitMessage(
                patchResult,
                isDefaultBranch ? `Created pull request against "${targetBranch}".` : `Pushed to branch "${targetBranch}" successfully.`,
                astChanges,
                projectName,
                targetPath
            ),
        }, { status: 200 }, patchResult);

    } catch (error: unknown) {
        console.error("Publish changes error:", error);
        // Safe error: don't leak internal details to clients
        return patchJson({
            success: false,
            localSynced: false,
            githubSynced: false,
            validationPassed: false,
            commitUrl: null,
            conflicts: false,
            errors: ["An unexpected error occurred. Please try again."],
            error: "An unexpected error occurred. Please try again.",
        }, { status: 500 });
    }
}

function patchSource(sourceCode: string, filePath: string, changes: ASTChange[]): PatchReport {
    return filePath.toLowerCase().endsWith(".html")
        ? patchHTMLWithReport(sourceCode, changes)
        : patchJSXWithReport(sourceCode, changes);
}

function noPatchResponse(report: PatchReport) {
    return patchJson({
        success: false,
        localSynced: false,
        githubSynced: false,
        validationPassed: false,
        commitUrl: null,
        conflicts: false,
        errors: ["No matching nodes were found for the provided selectors."],
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
