import { NextResponse } from "next/server";
import { extractFallbackSchemaFields } from "@/lib/scraper";
import { auth } from "@/auth";
import { checkAndIncrementQuota } from "@/lib/ratelimit";
import { prisma } from "@/lib/prisma";

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
        const session = await auth();
        let userId = session?.user?.id;
        let subscription = session?.user?.subscription || "free";

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
            subscription = "free";
        }

        const id = userId;

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

        // ── Local Fallback/Deterministic Extraction ───────────
        const schema = extractFallbackSchemaFields(html, url);

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
