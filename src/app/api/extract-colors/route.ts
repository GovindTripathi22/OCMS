import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth-guards";
import { withRateLimit } from "@/lib/ratelimit";
import { createErrorResponse, parseJsonSafely } from "@/lib/validation";
import { validateUrlForSsrf, fetchWithValidatedSsrfUrl } from "@/lib/ssrf";
import {
    extractColorsFromHtmlAndCss,
    matchPalette,
} from "@/lib/color-extractor";

export async function POST(req: NextRequest) {
    const rateLimited = await withRateLimit("extract-colors", req, { limit: 30, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const authCheck = await requireAuthenticatedUser();
    if (authCheck.error) {
        return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
    }

    const { data, error: jsonError } = await parseJsonSafely<{ brandDescription?: string; url?: string }>(req, 10 * 1024);
    if (jsonError) return jsonError;

    const brandDescription = data?.brandDescription?.trim() || "";
    const directUrl = data?.url?.trim() || "";
    const isUrl = directUrl || brandDescription.startsWith("http://") || brandDescription.startsWith("https://");
    const targetUrl = directUrl || (isUrl ? brandDescription : "");

    // Real Website Color Extraction flow
    if (targetUrl) {
        const validation = await validateUrlForSsrf(targetUrl);
        if (validation.safe) {
            try {
                const response = await fetchWithValidatedSsrfUrl(targetUrl, validation, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                        "Accept": "text/html,text/css,*/*",
                    },
                });

                if (response.ok) {
                    const html = await response.text();
                    const extracted = extractColorsFromHtmlAndCss(html.slice(0, 1024 * 1024)); // cap 1MB
                    if (extracted.length >= 5) {
                        return NextResponse.json({
                            success: true,
                            source: "website",
                            colors: extracted.slice(0, 5),
                        });
                    }
                }
            } catch (fetchErr) {
                console.warn("[Extract Colors] Failed to fetch target URL, falling back to keyword matcher:", fetchErr);
            }
        }
    }

    if (!brandDescription && !targetUrl) {
        return createErrorResponse("INVALID_INPUT", "brandDescription or url is required", 400);
    }

    if (brandDescription.length > 500) {
        return createErrorResponse("INPUT_TOO_LONG", "brandDescription cannot exceed 500 characters", 400);
    }

    const colors = matchPalette(brandDescription || targetUrl);

    return NextResponse.json({
        success: true,
        source: "curated",
        colors,
    });
}
