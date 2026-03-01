import { NextResponse } from "next/server";
import { cleanHtml } from "@/lib/scraper";

/**
 * POST /api/scrape
 *
 * Accepts { url: string } in the request body.
 * Fetches the page HTML and runs it through the rigorous 5-phase
 * cleaning pipeline to produce a minified, token-efficient DOM string.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url } = body;

        if (!url || typeof url !== "string") {
            return NextResponse.json(
                { error: "A valid `url` string is required" },
                { status: 400 }
            );
        }

        // Validate URL format
        try {
            new URL(url);
        } catch {
            return NextResponse.json(
                { error: "Invalid URL format" },
                { status: 400 }
            );
        }

        const response = await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (compatible; OCMS-Bot/1.0; +https://ocms.dev)",
                Accept: "text/html",
            },
            signal: AbortSignal.timeout(15000), // 15s timeout
        });

        if (!response.ok) {
            return NextResponse.json(
                {
                    error: `Failed to fetch: ${response.status} ${response.statusText}`,
                },
                { status: 502 }
            );
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("text/html")) {
            return NextResponse.json(
                { error: `Expected HTML but got: ${contentType}` },
                { status: 422 }
            );
        }

        const rawHtml = await response.text();
        const result = cleanHtml(rawHtml);

        return NextResponse.json({
            url,
            html: result.html,
            stats: {
                originalLength: result.originalLength,
                cleanedLength: result.cleanedLength,
                reductionPercent: result.reductionPercent,
                elementsRemoved: result.elementsRemoved,
            },
            fetchedAt: new Date().toISOString(),
        });
    } catch (err) {
        const message =
            err instanceof Error ? err.message : "Unknown scraping error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
