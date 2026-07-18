import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractFallbackSchemaFields } from "@/lib/scraper";
import { Prisma } from "@prisma/client";
import { getAuthorizedUser } from "@/auth";
import { fetchWithValidatedSsrfUrl, validateUrlForSsrf } from "@/lib/ssrf";
import { withRateLimit } from "@/lib/ratelimit";




export async function POST(
    req: NextRequest,
    { params }: { params: { projectId: string } }
) {
    try {
        const rateLimited = await withRateLimit("scan-page", req, { limit: 20, windowMs: 60_000 });
        if (rateLimited) return rateLimited;

        // Auth check FIRST — before any network requests
        const userId = await getAuthorizedUser();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { url, html } = await req.json();

        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        let pathname = "/";
        try {
            const parsed = new URL(url);
            pathname = parsed.pathname;
        } catch {
            return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
        }

        // Validate URL against SSRF blocklist
        const validation = await validateUrlForSsrf(url);
        if (!validation.safe) {
            return NextResponse.json(
                { error: validation.error || "Forbidden URL" },
                { status: validation.error?.includes("blocked") ? 403 : 400 }
            );
        }

        // Check project ownership before doing any work
        const existingProject = await prisma.project.findFirst({
            where: {
                id: params.projectId,
                userId: userId,
            }
        });

        if (!existingProject) {
            return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
        }

        // Fetch page content if not provided inline
        let scrapedHtml = html || "";
        let finalUrl = url;
        let scrapeFailed = false;

        if (!scrapedHtml) {
            try {
                let currentUrl = new URL(url);
                let currentValidation = validation;
                let response: Response;
                let redirects = 0;

                do {
                    response = await fetchWithValidatedSsrfUrl(currentUrl.href, currentValidation, {
                        redirect: "manual",
                        headers: {
                            "User-Agent": "Mozilla/5.0 (compatible; OCMS/1.0; +https://ocms.ai/bot)",
                            Accept: "text/html",
                        },
                        signal: AbortSignal.timeout(12000),
                    });

                    if (![301, 302, 303, 307, 308].includes(response.status)) break;
                    const location = response.headers.get("location");
                    if (!location || redirects++ >= 5) break;

                    currentUrl = new URL(location, currentUrl.href);
                    currentValidation = await validateUrlForSsrf(currentUrl.href);
                    if (!currentValidation.safe) {
                        scrapeFailed = true;
                        break;
                    }
                } while (true);

                if (!response.ok) {
                    scrapeFailed = true;
                    console.warn(`[Scan Page] HTTP ${response.status} for ${url}`);
                } else {
                    scrapedHtml = await response.text();
                    finalUrl = currentUrl.href;
                }
            } catch (err: unknown) {
                scrapeFailed = true;
                const errMsg = err instanceof Error ? err.message : String(err);
                console.error("[Scan Page Fetch Error]:", errMsg);
            }
        }

        if (scrapeFailed || !scrapedHtml) {
            return NextResponse.json({
                success: false,
                scrapeFailed: true,
                error: "Could not fetch page content. The URL may be unreachable or return no HTML.",
                schema: existingProject.generatedSchema ?? [],
                newFieldsCount: 0,
            }, { status: 200 }); // 200 so client can handle gracefully
        }

        // Generate new fields from the scraped HTML
        let newFields = extractFallbackSchemaFields(scrapedHtml, finalUrl);

        // Attach path to each new field
        newFields = newFields.map((f) => ({
            ...f,
            path: pathname,
        }));

        // Parse existing schema
        let existingFields: Record<string, unknown>[] = [];
        if (existingProject.generatedSchema) {
            const raw = existingProject.generatedSchema as unknown;
            if (Array.isArray(raw)) {
                existingFields = raw as Record<string, unknown>[];
            }
        }

        // Preserve fields for OTHER paths (don't touch them)
        const preservedFields = existingFields.filter((f: Record<string, unknown>) => {
            const fPath = (f.path as string) || "/";
            return fPath !== pathname;
        });

        // Deduplicate: skip new fields whose selector already exists in preserved fields
        const preservedSelectors = new Set(
            preservedFields.map((f) => f.selector as string).filter(Boolean)
        );
        const deduplicatedNewFields = newFields.filter(
            (f) => !f.selector || !preservedSelectors.has(f.selector)
        );

        const mergedSchema = [...preservedFields, ...deduplicatedNewFields];

        // Update database
        await prisma.project.update({
            where: { id: params.projectId },
            data: {
                generatedSchema: mergedSchema as unknown as Prisma.InputJsonValue,
            },
        });

        return NextResponse.json({
            success: true,
            schema: mergedSchema,
            newFieldsCount: deduplicatedNewFields.length,
            preservedFieldsCount: preservedFields.length,
        });

    } catch (error: unknown) {
        console.error("Scan page error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
