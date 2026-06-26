import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { patchJSXWithReport, type ASTChange, type PatchReport } from "@/lib/ast-patcher";
import { patchHTMLWithReport } from "@/lib/html-patcher";
import { normalizeChanges } from "@/lib/publish-change-normalizer";
import { Octokit } from "@octokit/rest";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        // 1. Authenticate user and get session or use guest fallback
        const session = await auth();
        let userId = session?.user?.id;

        if (!userId) {
            let guestUser = await prisma.user.findFirst({
                where: { email: "guest@ocms.ai" }
            });
            if (!guestUser) {
                guestUser = await prisma.user.create({
                    data: {
                        name: "Guest User",
                        email: "guest@ocms.ai",
                    }
                });
            }
            userId = guestUser.id;
        }

        const { repoOwner, repoName, filePath, changes } = await req.json();

        if (!repoOwner || !repoName || !filePath || !changes || !Array.isArray(changes)) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const astChanges = normalizeChanges(changes);
        if (!astChanges.length) {
            return NextResponse.json({ error: "No patchable JSX changes were provided" }, { status: 400 });
        }

        // Fetch GitHub access token from the Prisma Account table
        const account = await prisma.account.findFirst({
            where: {
                userId: userId,
                provider: "github",
            },
        });

        if (!account || !account.access_token) {
            return NextResponse.json({
                success: true,
                message: "[DEMO MODE] Sync simulated successfully. Login to push to real GitHub.",
                commitUrl: "#"
            }, { status: 200 });
        }

        if (account.access_token === "mock_token") {
            try {
                const localRoot = path.resolve(process.env.LOCAL_WORKSPACE_PATH || process.cwd());
                const localFilePath = path.resolve(localRoot, filePath);
                const insideLocalRoot = localFilePath === localRoot || localFilePath.startsWith(`${localRoot}${path.sep}`);

                if (!insideLocalRoot || !fs.existsSync(localFilePath)) {
                    return NextResponse.json({ error: `Local file not found: ${filePath}` }, { status: 404 });
                }

                const localContent = fs.readFileSync(localFilePath, "utf8");
                const patchResult = patchSource(localContent, filePath, astChanges);
                const updatedCode = patchResult.code;

                if (patchResult.appliedCount === 0) {
                    return noPatchResponse(patchResult);
                }

                if (updatedCode === localContent) {
                    return NextResponse.json({
                        success: true,
                        message: "Matching nodes were found, but no source changes were necessary.",
                        commitUrl: "#",
                        unchanged: true,
                        matchedSelectors: patchResult.matchedSelectors,
                    }, { status: 200 });
                }

                fs.writeFileSync(localFilePath, updatedCode, "utf8");
                console.log(`[Local Sync] Successfully updated local file in Mock mode: ${localFilePath}`);

                return NextResponse.json({
                    success: true,
                    message: "Local file updated successfully (Offline Mode).",
                    commitUrl: "#"
                }, { status: 200 });
            } catch (err) {
                console.error("Local mock publish error:", err);
                return NextResponse.json({ error: `Local publish failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
            }
        }

        // Initialize Octokit with the user's token
        const octokit = new Octokit({ auth: account.access_token });

        // --- STEP 1: The GitHub Fetch (Octokit) ---
        // Fetch the target file content from the repository
        let fileData;
        try {
            const { data } = await octokit.repos.getContent({
                owner: repoOwner,
                repo: repoName,
                path: filePath,
            });
            fileData = data;
        } catch (err: unknown) {
            console.error("Octokit getContent error:", err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            return NextResponse.json({ error: `Failed to fetch file from GitHub: ${errorMessage}` }, { status: 404 });
        }

        if (Array.isArray(fileData) || fileData.type !== "file") {
            return NextResponse.json({ error: "Target path is not a valid file" }, { status: 400 });
        }

        const fileSha = fileData.sha;
        // The content from GitHub API is base64 encoded, need to decode it to UTF-8
        const decodedContent = Buffer.from(fileData.content, "base64").toString("utf8");

        // --- STEP 2: Deterministic AST Code Modifier (AI-Free) ---
        const patchResult = patchSource(decodedContent, filePath, astChanges);
        const updatedCode = patchResult.code;
        if (patchResult.appliedCount === 0) {
            return noPatchResponse(patchResult);
        }

        if (updatedCode === decodedContent) {
            return NextResponse.json({
                success: true,
                message: "Matching nodes were found, but no source changes were necessary.",
                commitUrl: "#",
                unchanged: true,
                matchedSelectors: patchResult.matchedSelectors,
            }, { status: 200 });
        }

        // Write changes back to the local workspace code files (R5 Local Sync)
        try {
            const localRoot = path.resolve(process.env.LOCAL_WORKSPACE_PATH || process.cwd());
            const localFilePath = path.resolve(localRoot, filePath);
            const insideLocalRoot = localFilePath === localRoot || localFilePath.startsWith(`${localRoot}${path.sep}`);

            if (insideLocalRoot && fs.existsSync(localFilePath)) {
                fs.writeFileSync(localFilePath, updatedCode, "utf8");
                console.log(`[Local Sync] Successfully updated local file: ${localFilePath}`);
            } else if (!insideLocalRoot) {
                console.warn(`[Local Sync] Refused to write outside workspace: ${localFilePath}`);
            } else {
                console.warn(`[Local Sync] Local file not found: ${localFilePath}`);
            }
        } catch (localErr) {
            console.error("[Local Sync Error]:", localErr);
        }

        // --- STEP 3: The GitHub Push (Octokit) ---
        // Encode the updated code back to base64
        const encodedContent = Buffer.from(updatedCode).toString("base64");

        const { data: updateResult } = await octokit.repos.createOrUpdateFileContents({
            owner: repoOwner,
            repo: repoName,
            path: filePath,
            message: "OCMS: Automated Content Update",
            content: encodedContent,
            sha: fileSha,
        });

        return NextResponse.json({
            success: true,
            message: "Code successfully updated and pushed to GitHub main branch.",
            commitUrl: updateResult.commit.html_url
        }, { status: 200 });

    } catch (error: unknown) {
        console.error("Publish changes error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

function patchSource(sourceCode: string, filePath: string, changes: ASTChange[]): PatchReport {
    return filePath.toLowerCase().endsWith(".html")
        ? patchHTMLWithReport(sourceCode, changes)
        : patchJSXWithReport(sourceCode, changes);
}

function noPatchResponse(report: PatchReport) {
    return NextResponse.json({
        error: "No matching JSX or HTML nodes were found for the provided selectors",
        unmatchedSelectors: report.unmatchedSelectors,
        matchedSelectors: report.matchedSelectors,
    }, { status: 422 });
}
