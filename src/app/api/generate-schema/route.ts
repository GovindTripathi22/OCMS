import { NextResponse, type NextRequest } from "next/server";
import { extractFallbackSchemaFields } from "@/lib/scraper";
import { getAuthorizedUser } from "@/auth";
import { withRateLimit } from "@/lib/ratelimit";

/**
 * POST /api/generate-schema
 *
 * Receives cleaned HTML, extracts editable content fields locally using Cheerio,
 * and returns a JSON array of editable content fields.
 *
 * Enforces: Authentication → Rate Limiting → Local Scraper
 */
export async function POST(request: Request) {
    try {
        // ── Auth Check ───────────────────────────────────────
        const userId = await getAuthorizedUser();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        
        const rateLimited = await withRateLimit("generate-schema", request as unknown as NextRequest, { limit: 30, windowMs: 60_000 });
        if (rateLimited) return rateLimited;

        // ── Parse Request ────────────────────────────────────
        const body = await request.json();
        const { html, url } = body;

        if (!html || typeof html !== "string") {
            return NextResponse.json(
                { error: "A valid `html` string is required" },
                { status: 400 }
            );
        }

        // ── Local Fallback/Deterministic Extraction ───────────
        const schema = extractFallbackSchemaFields(html, url);

        return NextResponse.json(
            {
                schema,
                sourceUrl: url ?? null,
                generatedAt: new Date().toISOString(),
            },
            {
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );
    } catch (err) {
        const message =
            err instanceof Error ? err.message : "Schema generation failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
