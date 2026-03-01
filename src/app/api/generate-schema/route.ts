import { NextResponse } from "next/server";
import { generateSchema } from "@/lib/gemini";
import { auth } from "@/auth";
import { checkAndIncrementQuota } from "@/lib/ratelimit";

/**
 * POST /api/generate-schema
 *
 * Receives cleaned HTML, sends it to Gemini with a strict system prompt,
 * and returns a JSON array of editable content fields.
 *
 * Enforces: Authentication → Rate Limiting → AI Generation
 */
export async function POST(request: Request) {
    try {
        // ── Auth Check ───────────────────────────────────────
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized — sign in to generate schemas" },
                { status: 401 }
            );
        }

        const { id, subscription } = session.user;

        // ── Rate Limit Check ─────────────────────────────────
        const quota = await checkAndIncrementQuota(id, subscription);

        if (!quota.allowed) {
            return NextResponse.json(
                {
                    error: `Rate limit exceeded (${quota.limit} generations per cycle). Upgrade to PRO for more.`,
                    limit: quota.limit,
                    remaining: 0,
                    resetsAt: quota.resetsAt.toISOString(),
                },
                { status: 429 }
            );
        }

        // ── Parse Request ────────────────────────────────────
        const body = await request.json();
        const { html, url } = body;

        if (!html || typeof html !== "string") {
            return NextResponse.json(
                { error: "A valid `html` string is required" },
                { status: 400 }
            );
        }

        // ── AI Generation ────────────────────────────────────
        const schema = await generateSchema(html, url);

        return NextResponse.json(
            {
                schema,
                sourceUrl: url ?? null,
                generatedAt: new Date().toISOString(),
                quota: {
                    remaining: quota.remaining,
                    limit: quota.limit,
                    resetsAt: quota.resetsAt.toISOString(),
                },
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
