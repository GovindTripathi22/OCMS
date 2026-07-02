import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedUser } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Octokit } from "@octokit/rest";

const THEME_PROPS = [
    "--theme-background",
    "--theme-primary",
    "--theme-secondary",
    "--theme-accent",
    "--theme-text",
] as const;

/**
 * Deterministic CSS patcher that inserts or updates the five theme-color
 * custom properties inside the `:root` block. If no `:root` block exists,
 * one is prepended to the file. All other CSS is preserved verbatim.
 */
function patchCssWithThemeColors(currentCss: string, colors: string[]): string {
    const declarations = THEME_PROPS.map(
        (prop, i) => `    ${prop}: ${colors[i]};`
    ).join("\n");

    // Match the first :root { … } block (handles nested braces by being lazy
    // up to the matching closing brace on its own line or after content).
    const rootBlockRe = /(:root\s*\{)([^}]*)(\})/;
    const match = currentCss.match(rootBlockRe);

    if (match) {
        // Remove any existing theme-color properties so we don't duplicate them
        let innerContent = match[2];
        for (const prop of THEME_PROPS) {
            // Remove the whole line containing this property (including newline)
            const propLineRe = new RegExp(
                `[ \t]*${prop.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\s*:[^;]*;[ \t]*\n?`,
                "g"
            );
            innerContent = innerContent.replace(propLineRe, "");
        }

        // Ensure the inner content ends with a newline before our new block
        const trimmed = innerContent.trimEnd();
        const separator = trimmed.length > 0 ? "\n\n" : "\n";

        const updatedInner = trimmed + separator + declarations + "\n";
        return currentCss.replace(rootBlockRe, `$1${updatedInner}$3`);
    }

    // No :root block found — prepend one
    const rootBlock = `:root {\n${declarations}\n}\n\n`;
    return rootBlock + currentCss;
}

/**
 * POST /api/theme-colors
 *
 * Pushes a 5-color palette as CSS custom properties to the target site's
 * globals.css file on GitHub. Uses a deterministic local CSS patcher to
 * merge the new palette variables into the existing CSS.
 */
export async function POST(req: NextRequest) {
    try {
        // Auth Check
        const userId = await getAuthorizedUser();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

        // 5. Deterministically merge the new theme colors into the CSS
        const updatedCss = patchCssWithThemeColors(currentCss, colors);

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
