import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedUser } from "@/auth";
import { extractFallbackSchemaFields } from "@/lib/scraper";
import { Prisma } from "@prisma/client";
import { fetchWithValidatedSsrfUrl, validateUrlForSsrf } from "@/lib/ssrf";
import { withRateLimit } from "@/lib/ratelimit";
import type { SchemaField } from "@/types/schema";

export async function POST(req: Request) {
    try {
        const rateLimited = await withRateLimit("projects", req, { limit: 20, windowMs: 60_000 });
        if (rateLimited) return rateLimited;

        const { url, name } = await req.json();
        
        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        // Get the current authorized user
        const userId = await getAuthorizedUser();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Validate URL format and security via shared SSRF utility
        const validation = await validateUrlForSsrf(url);
        if (!validation.safe) {
            return NextResponse.json(
                { error: validation.error || "Forbidden URL" },
                { status: validation.error?.includes("blocked") ? 403 : 400 }
            );
        }

        // Automatically scrape and generate schema from the real site
        let schemaFields: SchemaField[] | null = null;
        try {
            let response = await fetchWithValidatedSsrfUrl(url, validation, {
                redirect: "manual",
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    Accept: "text/html",
                },
                signal: AbortSignal.timeout(12000), // 12s timeout
            });

            let currentUrl = new URL(url);
            let redirectCount = 0;
            const maxRedirects = 5;

            while ([301, 302, 303, 307, 308].includes(response.status) && redirectCount < maxRedirects) {
                const location = response.headers.get("location");
                if (!location) break;

                const nextUrl = new URL(location, currentUrl.href);
                if (nextUrl.origin !== currentUrl.origin) {
                    console.log(`Blocking cross-origin redirect during scraping from ${currentUrl.origin} to ${nextUrl.origin}`);
                    break;
                }

                currentUrl = nextUrl;
                redirectCount++;
                const redirectValidation = await validateUrlForSsrf(currentUrl.href);
                if (!redirectValidation.safe) break;

                response = await fetchWithValidatedSsrfUrl(currentUrl.href, redirectValidation, {
                    redirect: "manual",
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        Accept: "text/html",
                    },
                    signal: AbortSignal.timeout(12000),
                });
            }

            if (response.ok) {
                const rawHtml = await response.text();
                schemaFields = extractFallbackSchemaFields(rawHtml, currentUrl.href);
            }
        } catch (err) {
            console.error("Auto schema generation failed:", err);
        }

        // If scraping produced no fields, use an empty schema.
        // The workspace will prompt the user to scan the page manually.
        // We never inject placeholder/dummy fields into real project data.
        const scrapeFailed = !schemaFields || schemaFields.length === 0;
        if (!schemaFields || schemaFields.length === 0) {
            schemaFields = [];
        }

        // Generate GSD planning data
        const defaultGsdData = {
            projectMd: `# Project: ${name || "Untitled Project"}\n\nCore Value: Build Smarter. Edit Faster.`,
            requirementsMd: `# Requirements: ${name || "Untitled Project"}\n\n## v1 Requirements\n\n### General\n- [ ] **GEN-01**: Build responsive main landing layout\n- [ ] **GEN-02**: Integrate dynamic typography and theme configuration`,
            roadmapMd: `# Roadmap: ${name || "Untitled Project"}\n\n## Phases\n\n- [ ] **Phase 1: Foundation** - Basic landing structures\n- [ ] **Phase 2: Material Theme** - Color custom variables\n\n### Phase 1: Foundation\nGoal: Build base layout\nPlans:\n- [ ] 01-01: Setup skeleton structure\n\n### Phase 2: Material Theme\nGoal: Customize variables\nPlans:\n- [ ] 02-01: Update colors\n\n## Progress\n| Phase | Plans | Status | Completed |\n|---|---|---|---|\n| 1. Foundation | 0/1 | Not started | - |`,
            stateMd: `---
gsd_state_version: '1.0'
status: planning
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 2
  completed_plans: 0
  percent: 0
---
# Project State
## Current Position\nPhase: 1 of 2 (Foundation)\nPlan: 0 of 2 in current phase\nStatus: Planning\nLast activity: Initialized project`
        };

        const gsdData = defaultGsdData;

        // Create the project
        const project = await prisma.project.create({
            data: {
                name: name || "Untitled Project",
                sourceUrl: url,
                userId: userId,
                generatedSchema: schemaFields as unknown as Prisma.InputJsonValue,
                brandGuidelines: { gsd: gsdData } as unknown as Prisma.InputJsonValue
            }
        });

        return NextResponse.json({ ...project, scrapeFailed });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Failed to create project:", error);
        return NextResponse.json({ error: "Internal Server Error", details: message }, { status: 500 });
    }
}
