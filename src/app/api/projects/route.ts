import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/auth-guards";
import { extractFallbackSchemaFields } from "@/lib/scraper";
import { Prisma } from "@prisma/client";
import { fetchWithValidatedSsrfUrl, validateUrlForSsrf } from "@/lib/ssrf";
import { withRateLimit } from "@/lib/ratelimit";
import { validateMutationOrigin } from "@/lib/csrf";
import { createErrorResponse, parseJsonSafely, validateHttpUrl, validateProjectName, LIMITS } from "@/lib/validation";
import type { SchemaField } from "@/types/schema";

export async function GET() {
    const authCheck = await requireAuthenticatedUser();
    if (authCheck.error) {
        return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
    }
    const userId = authCheck.userId;

    const projects = await prisma.project.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ success: true, projects });
}

export async function POST(req: NextRequest) {
    const csrfError = validateMutationOrigin(req);
    if (csrfError) return csrfError;

    const rateLimited = await withRateLimit("projects", req, { limit: 20, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const authCheck = await requireAuthenticatedUser();
    if (authCheck.error) {
        return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
    }
    const userId = authCheck.userId;

    const { data, error: jsonError } = await parseJsonSafely<{ url?: string; name?: string }>(req, 10 * 1024);
    if (jsonError) return jsonError;

    const url = data?.url?.trim();
    const rawName = data?.name?.trim() || "Untitled Project";

    const nameValidation = validateProjectName(rawName);
    if (!nameValidation.valid) {
        return createErrorResponse("INVALID_PROJECT_NAME", nameValidation.error || "Invalid project name", 400);
    }
    const name = rawName.slice(0, LIMITS.PROJECT_NAME_MAX_LENGTH);

    const urlValidation = validateHttpUrl(url);
    if (!urlValidation.valid || !url) {
        return createErrorResponse("INVALID_URL", urlValidation.error || "A valid http/https URL is required", 400);
    }

    // SSRF URL Security Validation
    const validation = await validateUrlForSsrf(url);
    if (!validation.safe) {
        return createErrorResponse(
            "SSRF_BLOCKED",
            validation.error || "Access to requested target URL is forbidden",
            validation.error?.includes("blocked") ? 403 : 400
        );
    }

    let schemaFields: SchemaField[] = [];
    let scrapeFailed = false;

    try {
        const response = await fetchWithValidatedSsrfUrl(url, validation, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                Accept: "text/html,application/xhtml+xml",
            },
            signal: AbortSignal.timeout(12000),
        });

        if (response.ok) {
            const rawHtml = await response.text();
            if (rawHtml.length <= LIMITS.HTML_PAYLOAD_MAX_BYTES) {
                schemaFields = extractFallbackSchemaFields(rawHtml, response.url || url);
            }
        }
    } catch (err) {
        console.warn("[Project Create] Auto-scan error during project creation:", err);
    }

    if (!schemaFields || schemaFields.length === 0) {
        schemaFields = [];
        scrapeFailed = true;
    }

    // Initialize clean GSD planning state in dedicated column
    const initialGsdState = {
        stateMd: `---\ngsd_state_version: '1.0'\nstatus: planning\nprogress:\n  total_phases: 2\n  completed_phases: 0\n  total_plans: 2\n  completed_plans: 0\n  percent: 0\n---\n# Project State\n## Current Position\nPhase: 1 of 2 (Foundation)\nPlan: 0 of 2 in current phase\nStatus: Planning\nLast activity: Initialized project`,
    };

    try {
        const project = await prisma.project.create({
            data: {
                name,
                sourceUrl: url,
                userId,
                generatedSchema: schemaFields as unknown as Prisma.InputJsonValue,
                schemaRevision: 0,
                gsdState: initialGsdState as unknown as Prisma.InputJsonValue,
            },
        });

        return NextResponse.json(
            {
                success: true,
                ...project,
                scrapeFailed,
            },
            { status: 201 }
        );
    } catch (error: unknown) {
        console.error("Failed to create project:", error);
        return createErrorResponse("DB_ERROR", "Failed to create project in database", 500);
    }
}
