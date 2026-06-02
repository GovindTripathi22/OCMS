import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Octokit } from "@octokit/rest";
import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Verification function for GitHub Webhook Signature
function verifySignature(payload: string, signature: string, secret: string): boolean {
    const hmac = crypto.createHmac("sha256", secret);
    const digest = Buffer.from("sha256=" + hmac.update(payload).digest("hex"), "utf8");
    const sigBuffer = Buffer.from(signature, "utf8");
    return sigBuffer.length === digest.length && crypto.timingSafeEqual(sigBuffer, digest);
}

export async function POST(req: NextRequest) {
    try {
        const payloadText = await req.text();
        const signature = req.headers.get("x-hub-signature-256") || "";
        const event = req.headers.get("x-github-event") || "";

        // Optional signature verification
        const secret = process.env.GITHUB_WEBHOOK_SECRET;
        if (secret && !verifySignature(payloadText, signature, secret)) {
            console.error("[Webhook Error]: Signature verification failed.");
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        if (event !== "push") {
            return NextResponse.json({ message: `Ignored event: ${event}` }, { status: 200 });
        }

        const payload = JSON.parse(payloadText);
        const repoFullName = payload.repository?.full_name; // e.g. "owner/repo"
        const ref = payload.ref || ""; // e.g. "refs/heads/main"
        const branch = ref.replace("refs/heads/", "");

        if (!repoFullName) {
            return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
        }

        const [repoOwner, repoName] = repoFullName.split("/");

        // Find projects linked to this repo
        const projects = await prisma.project.findMany({
            where: {
                githubOwner: { equals: repoOwner },
                githubRepo: { equals: repoName },
                githubBranch: { equals: branch },
            },
        });

        if (projects.length === 0) {
            return NextResponse.json({ message: "No matching projects found for this repository." }, { status: 200 });
        }

        // Get list of modified files in the push
        const modifiedFiles: string[] = [];
        if (payload.commits && Array.isArray(payload.commits)) {
            for (const commit of payload.commits) {
                if (commit.added) modifiedFiles.push(...commit.added);
                if (commit.modified) modifiedFiles.push(...commit.modified);
            }
        }

        console.log(`[Webhook Sync] Push on ${repoFullName}:${branch}. Modified files:`, modifiedFiles);

        let syncCount = 0;

        for (const project of projects) {
            if (!project.targetFilePath) continue;

            const isTargetModified = modifiedFiles.includes(project.targetFilePath);
            if (!isTargetModified) {
                console.log(`[Webhook Sync] Target file ${project.targetFilePath} not modified for project ${project.id}. Skipping.`);
                continue;
            }

            // Fetch GitHub access token from the user account
            const account = await prisma.account.findFirst({
                where: {
                    userId: project.userId,
                    provider: "github",
                },
            });

            // Use user's access token or fallback to server credentials if present
            const token = account?.access_token || process.env.GITHUB_ACCESS_TOKEN;
            if (!token) {
                console.warn(`[Webhook Sync] No GitHub token found for user ${project.userId} or server. Skipping.`);
                continue;
            }

            const octokit = new Octokit({ auth: token });

            try {
                const { data: fileData } = await octokit.repos.getContent({
                    owner: repoOwner,
                    repo: repoName,
                    path: project.targetFilePath,
                    ref: branch,
                }) as { data: { type: string; content: string } };

                if (Array.isArray(fileData) || fileData.type !== "file") continue;

                const decodedContent = Buffer.from(fileData.content, "base64").toString("utf8");

                // Parse current schema fields
                const currentSchema = (project.generatedSchema as unknown[]) || [];
                if (currentSchema.length === 0) continue;

                // Call Gemini to sync the values from the updated source code into the schema fields
                const systemInstruction = `You are a strict React source parser. You will be given the source code of a React/HTML page and a JSON schema of visual fields containing 'id', 'selector', 'type', and 'value'.
Your goal is to parse the new source code, extract the updated values for each visual field matching its selector, and output a JSON array of the fields with their updated values.
Do NOT modify the field structure, IDs, selectors, or types. If a selector cannot be found, keep its current value.
Return ONLY a raw valid JSON array. Do not wrap in markdown or backticks.`;

                const prompt = `React Source Code:\n\n${decodedContent}\n\nCurrent Fields Schema:\n\n${JSON.stringify(currentSchema, null, 2)}`;

                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: prompt,
                    config: {
                        systemInstruction,
                        temperature: 0.1,
                    },
                });

                let text = response.text || "";
                if (text.startsWith("```")) {
                    const lines = text.split("\n");
                    if (lines[0].startsWith("```")) lines.shift();
                    if (lines[lines.length - 1].startsWith("```")) lines.pop();
                    text = lines.join("\n");
                }

                const updatedSchema = JSON.parse(text);

                // Update database
                await prisma.project.update({
                    where: { id: project.id },
                    data: {
                        generatedSchema: updatedSchema,
                    },
                });

                console.log(`[Webhook Sync] Project ${project.id} updated schema successfully.`);
                syncCount++;

            } catch (err) {
                console.error(`[Webhook Sync Error] Failed to sync project ${project.id}:`, err);
            }
        }

        return NextResponse.json({
            success: true,
            syncedProjects: syncCount,
            totalMatchedProjects: projects.length,
        }, { status: 200 });

    } catch (err: unknown) {
        console.error("[Webhook Error]:", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: "Internal Server Error", details: errMsg }, { status: 500 });
    }
}
