import { NextRequest, NextResponse } from "next/server";
import { cleanHtml } from "@/lib/scraper";
import { fetchWithValidatedSsrfUrl, validateUrlForSsrf } from "@/lib/ssrf";
import { withRateLimit } from "@/lib/ratelimit";
import { requireAuthenticatedUser } from "@/lib/auth-guards";
import { createErrorResponse, parseJsonSafely, validateHttpUrl, LIMITS } from "@/lib/validation";

/**
 * POST /api/scrape
 * Accepts { url: string } in the request body.
 * Runs through SSRF security validation, fetches bounded HTML, and applies 5-phase cleaner.
 */
export async function POST(request: NextRequest) {
    const rateLimited = await withRateLimit("scrape", request, { limit: 30, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const authCheck = await requireAuthenticatedUser();
    if (authCheck.error) {
        return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
    }

    const { data, error: jsonError } = await parseJsonSafely<{ url?: string }>(request, 10 * 1024);
    if (jsonError) return jsonError;

    const rawUrl = data?.url?.trim();
    const urlValidation = validateHttpUrl(rawUrl);
    if (!urlValidation.valid || !rawUrl) {
        return createErrorResponse("INVALID_URL", urlValidation.error || "A valid http/https URL is required", 400);
    }

    // Comprehensive SSRF Validation
    const ssrfValidation = await validateUrlForSsrf(rawUrl);
    if (!ssrfValidation.safe) {
        return createErrorResponse(
            "SSRF_BLOCKED",
            ssrfValidation.error || "Access to requested target URL is forbidden",
            ssrfValidation.error?.includes("blocked") ? 403 : 400
        );
    }

    try {
        const response = await fetchWithValidatedSsrfUrl(rawUrl, ssrfValidation, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; OCMS-Bot/1.0; +https://ocms.dev)",
                Accept: "text/html,application/xhtml+xml",
            },
            signal: AbortSignal.timeout(15000), // 15s timeout
        });

        if (!response.ok) {
            return createErrorResponse(
                "FETCH_FAILED",
                `Target server responded with error: ${response.status} ${response.statusText}`,
                502
            );
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
            return createErrorResponse(
                "INVALID_CONTENT_TYPE",
                `Expected HTML content, but target returned: ${contentType}`,
                422
            );
        }

        // Bounded read (max 5MB HTML)
        const text = await response.text();
        if (text.length > LIMITS.HTML_PAYLOAD_MAX_BYTES) {
            return createErrorResponse("CONTENT_TOO_LARGE", "Scraped HTML exceeds 5MB size limit", 413);
        }

        const result = cleanHtml(text);

        return NextResponse.json({
            success: true,
            url: rawUrl,
            html: result.html,
            stats: {
                originalLength: result.originalLength,
                cleanedLength: result.cleanedLength,
                reductionPercent: result.reductionPercent,
                elementsRemoved: result.elementsRemoved,
            },
            fetchedAt: new Date().toISOString(),
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Target fetch failed";
        return createErrorResponse("SCRAPE_ERROR", message, 500);
    }
}
