import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Octokit } from "@octokit/rest";
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: NextRequest) {
    try {
        // 1. Authenticate user and get session
        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { repoOwner, repoName, filePath, changes } = await req.json();

        if (!repoOwner || !repoName || !filePath || !changes || !Array.isArray(changes)) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Fetch GitHub access token from the Prisma Account table
        const account = await prisma.account.findFirst({
            where: {
                userId: session.user.id,
                provider: "github",
            },
        });

        if (!account || !account.access_token) {
            return NextResponse.json({ error: "GitHub account not linked or missing access token" }, { status: 403 });
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

        // --- STEP 2: The AI Code Modifier (Gemini 3.1 Pro) ---
        const systemInstruction = "You are a senior React developer. Here is the source code for a webpage and a list of content changes the user wants to make. Carefully locate the correct HTML/React nodes and update the text or image URLs. DO NOT alter any logic, Tailwind classes, or surrounding components. Return ONLY the raw, updated code string. Do not use markdown code blocks.";

        const prompt = `Here is the current source code:\n\n${decodedContent}\n\nHere are the content changes to apply:\n${JSON.stringify(changes, null, 2)}`;

        const geminiResponse = await ai.models.generateContent({
            model: "gemini-3.1-pro",
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                // Using low temperature to prevent hallucinating extra code changes
                temperature: 0.1,
            },
        });

        let updatedCode = geminiResponse.text;

        if (!updatedCode) {
            return NextResponse.json({ error: "Gemini failed to generate updated code" }, { status: 500 });
        }

        // Strip markdown code blocks just in case the model ignored the system instruction
        if (updatedCode.startsWith('\`\`\`')) {
            const lines = updatedCode.split('\n');
            if (lines[0].startsWith('\`\`\`')) lines.shift();
            if (lines[lines.length - 1].startsWith('\`\`\`')) lines.pop();
            updatedCode = lines.join('\n');
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
