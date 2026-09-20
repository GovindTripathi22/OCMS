import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractFallbackSchemaFields } from "@/lib/scraper";
import { Prisma } from "@prisma/client";
import { requireAuthenticatedUser, requireOwnedProject } from "@/lib/auth-guards";
import { fetchWithValidatedSsrfUrl, validateUrlForSsrf } from "@/lib/ssrf";
import { withRateLimit } from "@/lib/ratelimit";
import { validateMutationOrigin } from "@/lib/csrf";
import { createErrorResponse, parseJsonSafely, validateHttpUrl, LIMITS } from "@/lib/validation";
import type { SchemaField } from "@/types/schema";

export async function POST(
    req: NextRequest,
    { params }: { params: { projectId: string } }
) {
    const csrfError = validateMutationOrigin(req);
    if (csrfError) return csrfError;

    const rateLimited = await withRateLimit("scan-page", req, { limit: 20, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const authCheck = await requireAuthenticatedUser();
    if (authCheck.error) {
        return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
    }
    const userId = authCheck.userId;

    const projectCheck = await requireOwnedProject(params.projectId, userId);
    if (projectCheck.error) {
        return createErrorResponse(projectCheck.error.code, projectCheck.error.message, projectCheck.error.status);
    }
    const existingProject = projectCheck.project;

    const { data, error: jsonError } = await parseJsonSafely<{ url?: string; html?: string }>(
        req,
        LIMITS.HTML_PAYLOAD_MAX_BYTES + 1024
    );
    if (jsonError) return jsonError;

    const url = data?.url?.trim();
    if (!url) {
        return createErrorResponse("INVALID_URL", "URL is required", 400);
    }

    const urlValidation = validateHttpUrl(url);
    if (!urlValidation.valid) {
        return createErrorResponse("INVALID_URL", urlValidation.error || "Invalid URL format", 400);
    }

    let pathname = "/";
    try {
        const parsed = new URL(url);
        pathname = parsed.pathname || "/";
    } catch {
        return createErrorResponse("INVALID_URL", "Invalid URL format", 400);
    }

    // Validate URL against SSRF blocklist
    const validation = await validateUrlForSsrf(url);
    if (!validation.safe) {
        return createErrorResponse(
            "SSRF_BLOCKED",
            validation.error || "Access to requested URL is forbidden",
            validation.error?.includes("blocked") ? 403 : 400
        );
    }

    let scrapedHtml = data?.html || "";
    let finalUrl = url;
    let scrapeFailed = false;

    if (!scrapedHtml) {
        try {
            const response = await fetchWithValidatedSsrfUrl(url, validation, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; OCMS/1.0; +https://ocms.dev/bot)",
                    Accept: "text/html,application/xhtml+xml",
                },
                signal: AbortSignal.timeout(12000),
            });

            if (!response.ok) {
                scrapeFailed = true;
            } else {
                const text = await response.text();
                if (text.length <= LIMITS.HTML_PAYLOAD_MAX_BYTES) {
                    scrapedHtml = text;
                    finalUrl = response.url || url;
                } else {
                    scrapeFailed = true;
                }
            }
        } catch (err: unknown) {
            scrapeFailed = true;
            console.error("[Scan Page Fetch Error]:", err);
        }
    }

    if (scrapeFailed || !scrapedHtml) {
        return NextResponse.json({
            success: false,
            scrapeFailed: true,
            error: "Could not fetch page content. The URL may be unreachable or return invalid HTML.",
            schema: (existingProject.generatedSchema as unknown as SchemaField[]) ?? [],
            newFieldsCount: 0,
        }, { status: 200 });
    }

    // Generate new fields from the scraped HTML
    let newFields = extractFallbackSchemaFields(scrapedHtml, finalUrl);

    newFields = newFields.map((f) => ({
        ...f,
        path: pathname,
    }));

    let existingFields: SchemaField[] = [];
    if (existingProject.generatedSchema && Array.isArray(existingProject.generatedSchema)) {
        existingFields = existingProject.generatedSchema as unknown as SchemaField[];
    }

    const preservedFields = existingFields.filter((f) => (f.path || "/") !== pathname);
    const preservedSelectors = new Set(preservedFields.map((f) => f.selector).filter(Boolean));
    const deduplicatedNewFields = newFields.filter(
        (f) => !f.selector || !preservedSelectors.has(f.selector)
    );

    const mergedSchema = [...preservedFields, ...deduplicatedNewFields].slice(0, LIMITS.SCHEMA_MAX_FIELDS);

    try {
        await prisma.project.update({
            where: { id: params.projectId },
            data: {
                generatedSchema: mergedSchema as unknown as Prisma.InputJsonValue,
                schemaRevision: (existingProject.schemaRevision || 0) + 1,
            },
        });

        return NextResponse.json({
            success: true,
            schema: mergedSchema,
            newFieldsCount: deduplicatedNewFields.length,
            preservedFieldsCount: preservedFields.length,
        });
    } catch (error) {
        console.error("Scan page database error:", error);
        return createErrorResponse("DB_ERROR", "Failed to update project schema", 500);
    }
}
