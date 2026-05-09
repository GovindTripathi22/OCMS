import { NextRequest, NextResponse } from "next/server";
import { callGemini } from "@/lib/gemini";

/**
 * POST /api/steal-component
 *
 * Scrapes a URL and uses AI to recreate the component as clean React/JSX code.
 */
export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();

        if (!url || typeof url !== "string") {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        // 1. Fetch the target page HTML
        const fetchRes = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; OCMS-Bot/1.0)",
                Accept: "text/html",
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!fetchRes.ok) {
            return NextResponse.json({ error: `Failed to fetch: ${fetchRes.status}` }, { status: 502 });
        }

        const html = await fetchRes.text();
        // Take a reasonable chunk to send to AI
        const trimmedHtml = html.slice(0, 12000);

        // 2. Ask AI to recreate the hero/main component
        const systemPrompt = `You are a senior React developer specializing in UI replication.

YOUR TASK: Analyze the provided HTML from a website and recreate the HERO section (or the most visually prominent component) as a clean, modern React functional component using Tailwind CSS.

RULES:
1. Output ONLY the JSX code. No imports, no exports, no markdown fences.
2. Use Tailwind CSS utility classes for all styling.
3. Replace any external images with placeholder divs that describe the image.
4. Keep all text content exactly as it appears on the original site.
5. Make it responsive (use md: and lg: breakpoints).
6. Use semantic HTML (section, nav, article, etc.).
7. The output should be a single JSX fragment that can be dropped into a React component.`;

        const code = await callGemini(
            `Recreate the hero/main component from this HTML:\n\n${trimmedHtml}`,
            systemPrompt
        );

        // Clean any markdown fences
        let cleanCode = code;
        if (cleanCode.startsWith("```")) {
            const lines = cleanCode.split("\n");
            if (lines[0].startsWith("```")) lines.shift();
            if (lines[lines.length - 1]?.startsWith("```")) lines.pop();
            cleanCode = lines.join("\n");
        }

        return NextResponse.json({
            code: cleanCode,
            sourceUrl: url,
            generatedAt: new Date().toISOString(),
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Component steal failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
