import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { patchJSX, type ASTChange } from "@/lib/ast-patcher";
import { Octokit } from "@octokit/rest";
import fs from "fs";
import path from "path";

interface SourceChange {
    fieldId?: unknown;
    selector?: unknown;
    type?: unknown;
    newValue?: unknown;
    oldValue?: unknown;
    alt?: unknown;
    objectFit?: unknown;
    borderRadius?: unknown;
}

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
        const updatedCode = patchJSX(decodedContent, astChanges);
        if (updatedCode === decodedContent) {
            return NextResponse.json({ error: "No matching JSX nodes were found for the provided selectors" }, { status: 422 });
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

function normalizeChanges(changes: SourceChange[]): ASTChange[] {
    return changes.reduce<ASTChange[]>((patches, change) => {
        if (typeof change.selector !== "string" || typeof change.newValue !== "string") return patches;

        const type = normalizeChangeType(change.type);
        if (!type) return patches;

        patches.push({
            type,
            selector: change.selector,
            newValue: change.newValue,
            oldValue: typeof change.oldValue === "string" ? change.oldValue : undefined,
            alt: typeof change.alt === "string" ? change.alt : undefined,
            objectFit: typeof change.objectFit === "string" ? change.objectFit : undefined,
            borderRadius: typeof change.borderRadius === "string" ? change.borderRadius : undefined,
        });

        return patches;
    }, []);
}

function normalizeChangeType(type: unknown): ASTChange["type"] | null {
    if (type === "text" || type === "image" || type === "link" || type === "3d-model") return type;
    if (type === "list") return "text";
    return null;
}