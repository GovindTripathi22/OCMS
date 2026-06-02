import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Octokit } from "@octokit/rest";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * POST /api/theme-colors
 *
 * Pushes a 5-color palette as CSS custom properties to the target site's
 * globals.css file on GitHub. Uses Gemini to intelligently merge the new
 * palette variables into the existing CSS.
 */
export async function POST(req: NextRequest) {
    try {
        // 1. Auth — session or guest fallback
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

        // 2. Parse request
        const { repoOwner, repoName, colors, cssFilePath } = await req.json();

        if (!repoOwner || !repoName || !Array.isArray(colors) || colors.length !== 5) {
            return NextResponse.json(
                { error: "Required: repoOwner, repoName, colors (array of 5 hex strings)" },
                { status: 400 }
            );
        }

        // 3. Get GitHub access token
        const account = await prisma.account.findFirst({
            where: { userId, provider: "github" },
        });

        if (!account || !account.access_token) {
            return NextResponse.json({
                success: true,
                message: "[DEMO MODE] Color palette saved locally. Login with GitHub to push to the live site.",
                colors,
                commitUrl: "#",
            });
        }

        const octokit = new Octokit({ auth: account.access_token });

        // 4. Fetch current globals.css from the repo
        const targetPath = cssFilePath || "src/app/globals.css";
        let fileData;
        try {
            const { data } = await octokit.repos.getContent({
                owner: repoOwner,
                repo: repoName,
                path: targetPath,
            });
            fileData = data;
        } catch {
            return NextResponse.json(
                { error: `Could not find ${targetPath} in ${repoOwner}/${repoName}` },
                { status: 404 }
            );
        }

        if (Array.isArray(fileData) || fileData.type !== "file") {
            return NextResponse.json({ error: "Target path is not a file" }, { status: 400 });
        }

        const fileSha = fileData.sha;
        const currentCss = Buffer.from(fileData.content, "base64").toString("utf8");

        // 5. Use Gemini to intelligently merge colors into CSS
        const [background, primary, secondary, accent, text] = colors;

        const systemInstruction = `You are a senior CSS developer. You are modifying a globals.css file to update its color theme.

RULES:
1. Add or update these CSS custom properties inside the :root selector (create one if it doesn't exist):
   --theme-background: ${background};
   --theme-primary: ${primary};
   --theme-secondary: ${secondary};
   --theme-accent: ${accent};
   --theme-text: ${text};
2. If these variables already exist, update their values.
3. If the file has no :root block, add one at the top of the file.
4. Do NOT remove ANY existing CSS rules, variables, or comments.
5. Do NOT change any other CSS custom properties or values.
6. Return ONLY the raw updated CSS. No markdown code blocks, no explanations.`;

        const prompt = `Update this CSS file with the new theme colors:\n\n${currentCss}`;

        const geminiResponse = await ai.models.generateContent({
            model: process.env.GEMINI_PUBLISH_MODEL ?? "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction,
                temperature: 0.05,
            },
        });

        const geminiResult = geminiResponse as unknown as {
            text?: string;
            response?: { text?: () => string };
        };
        let updatedCss = geminiResult.text ?? geminiResult.response?.text?.();

        if (!updatedCss) {
            return NextResponse.json({ error: "AI failed to generate updated CSS" }, { status: 500 });
        }

        // Strip markdown code blocks if present
        if (updatedCss.startsWith("```")) {
            const lines = updatedCss.split("\n");
            if (lines[0].startsWith("```")) lines.shift();
            if (lines[lines.length - 1].startsWith("```")) lines.pop();
            updatedCss = lines.join("\n");
        }

        // 6. Commit back to GitHub
        const encodedContent = Buffer.from(updatedCss).toString("base64");

        const { data: updateResult } = await octokit.repos.createOrUpdateFileContents({
            owner: repoOwner,
            repo: repoName,
            path: targetPath,
            message: `OCMS: Update theme colors — ${colors.join(", ")}`,
            content: encodedContent,
            sha: fileSha,
        });

        return NextResponse.json({
            success: true,
            message: "Theme colors pushed to GitHub successfully!",
            colors,
            commitUrl: updateResult.commit.html_url,
        });
    } catch (error: unknown) {
        console.error("Theme colors error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
