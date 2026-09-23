import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth-guards";
import { withRateLimit } from "@/lib/ratelimit";
import { validateUrlForSsrf, fetchWithValidatedSsrfUrl } from "@/lib/ssrf";
import { runLocalStaticAudit } from "@/lib/static-performance-audit";
import { createErrorResponse, parseJsonSafely, validateHttpUrl, LIMITS } from "@/lib/validation";

export async function POST(req: NextRequest) {
    const rateLimited = await withRateLimit("lighthouse-audit", req, { limit: 15, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const authCheck = await requireAuthenticatedUser();
    if (authCheck.error) {
        return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
    }

    const { data, error: jsonError } = await parseJsonSafely<{
        url?: string;
        html?: string;
        mode?: "local" | "online";
    }>(req, LIMITS.HTML_PAYLOAD_MAX_BYTES + 1024);
    if (jsonError) return jsonError;

    const url = data?.url?.trim();
    const inlineHtml = data?.html;
    const mode = data?.mode || "local";

    if (!url && !inlineHtml) {
        return createErrorResponse("INVALID_INPUT", "Either url or html content is required for audit", 400);
    }

    // Mode 1: Explicit Online Google PageSpeed Audit (only if explicitly requested and public)
    if (mode === "online" && url) {
        const urlVal = validateHttpUrl(url);
        if (!urlVal.valid) {
            return createErrorResponse("INVALID_URL", urlVal.error || "Valid public URL required for online audit", 400);
        }

        const validation = await validateUrlForSsrf(url);
        if (!validation.safe) {
            return createErrorResponse(
                "SSRF_BLOCKED",
                `Online PageSpeed audit cannot target local or private IPs (${validation.error})`,
                400
            );
        }

        try {
            const apiKey = process.env.PAGESPEED_API_KEY;
            let apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=PERFORMANCE&category=ACCESSIBILITY&category=SEO`;
            if (apiKey) {
                apiUrl += `&key=${apiKey}`;
            }

            const response = await fetch(apiUrl, {
                signal: AbortSignal.timeout(20000),
            });

            if (response.ok) {
                const apiData = await response.json();
                const categories = apiData.lighthouseResult?.categories;

                if (categories) {
                    const performance = Math.round((categories.performance?.score || 0) * 100);
                    const accessibility = Math.round((categories.accessibility?.score || 0) * 100);
                    const seo = Math.round((categories.seo?.score || 0) * 100);

                    return NextResponse.json({
                        success: true,
                        auditType: "ONLINE_PAGESPEED",
                        scores: { performance, accessibility, seo },
                        sourceUrl: url,
                        timestamp: new Date().toISOString(),
                    });
                }
            }

            return createErrorResponse("PAGESPEED_FAILED", "Google PageSpeed API request failed or returned invalid response", 502);
        } catch (apiErr) {
            console.error("[Online PageSpeed Error]:", apiErr);
            return createErrorResponse("PAGESPEED_ERROR", "Failed to connect to Google PageSpeed service", 502);
        }
    }

    // Mode 2: Deterministic Local Static Performance Audit (Default)
    let targetHtml = inlineHtml || "";

    if (!targetHtml && url) {
        const validation = await validateUrlForSsrf(url);
        if (!validation.safe) {
            return createErrorResponse("SSRF_BLOCKED", validation.error || "Target URL is blocked", 400);
        }

        try {
            const fetchRes = await fetchWithValidatedSsrfUrl(url, validation, {
                headers: { "User-Agent": "Mozilla/5.0 (compatible; OCMS-Audit/1.0; +https://ocms.dev)" },
                signal: AbortSignal.timeout(10000),
            });

            if (fetchRes.ok) {
                targetHtml = await fetchRes.text();
            }
        } catch (fetchErr) {
            console.warn("[Local Audit Fetch Error]:", fetchErr);
        }
    }

    if (!targetHtml) {
        return createErrorResponse(
            "FETCH_FAILED",
            "Could not fetch target page content to perform audit. Verify that the URL is reachable.",
            502
        );
    }

    const auditResult = runLocalStaticAudit(targetHtml);

    return NextResponse.json({
        success: true,
        ...auditResult,
        sourceUrl: url || null,
        timestamp: new Date().toISOString(),
    });
}
