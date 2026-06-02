import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { cleanHtml, extractFallbackSchemaFields, validateSchemaFields } from "@/lib/scraper";
import { generateSchema, callGemini, safeJsonParse } from "@/lib/gemini";
import { Prisma } from "@prisma/client";

export async function POST(req: Request) {
    try {
        const { url, name } = await req.json();
        
        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        // Get the current user or use a fallback "Guest" user for development
        const session = await auth();
        let userId = session?.user?.id;

        if (!userId) {
            // Check if a Guest user already exists
            let guestUser = await prisma.user.findFirst({
                where: { email: "guest@ocms.ai" }
            });

            if (!guestUser) {
                // Create a Guest user
                guestUser = await prisma.user.create({
                    data: {
                        name: "Guest User",
                        email: "guest@ocms.ai",
                    }
                });
            }
            userId = guestUser.id;
        }

        // Automatically scrape and generate schema from the real site
        let schemaFields = null;
        let scrapedHtml = "";
        let scrapedUrl = url;
        try {
            let response = await fetch(url, {
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
                response = await fetch(currentUrl.href, {
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
                scrapedHtml = rawHtml;
                scrapedUrl = currentUrl.href;
                const cleanResult = cleanHtml(rawHtml);
                const aiSchemaFields = await generateSchema(cleanResult.html, currentUrl.href);
                schemaFields = validateSchemaFields(rawHtml, aiSchemaFields, currentUrl.href);

                if (schemaFields.length === 0 && aiSchemaFields.length > 0) {
                    console.warn("AI schema generation returned fields, but none passed selector validation.");
                }
            }
        } catch (err) {
            console.error("Auto schema generation failed, using fallback:", err);
        }

        if (!schemaFields || schemaFields.length === 0) {
            schemaFields = scrapedHtml
                ? extractFallbackSchemaFields(scrapedHtml, scrapedUrl)
                : [
                { id: "hero-title", type: "text", label: "Hero Title", value: "Welcome to Our Site", selector: "h1" },
                { id: "hero-subtitle", type: "text", label: "Subtitle", value: "Build something amazing today.", selector: ".subtitle" },
                { id: "hero-image", type: "image", label: "Hero Image", value: "/placeholder.jpg", selector: "img.hero" },
                { id: "cta-link", type: "link", label: "CTA Link", value: "/get-started", selector: "a.cta" },
            ];
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

        let gsdData = defaultGsdData;
        try {
            const aiPrompt = `Act as a GSD Core PM. Generate a full GSD planning structure for the project named "${name || "Untitled Project"}" (a web application scraped from ${url}).
The generated structure must include four files: PROJECT.md, REQUIREMENTS.md, ROADMAP.md, and STATE.md.
Ensure there are at least 3 distinct phases in ROADMAP.md, each containing 1-2 concrete plans (e.g. 01-01, 01-02).
Ensure STATE.md sets phase 1 as the current focus and is ready to plan.
Return a single JSON object containing exact Markdown text with fields: "projectMd", "requirementsMd", "roadmapMd", "stateMd".`;

            const resText = await callGemini(aiPrompt, "You are a professional software planner.", true);
            const resJson = safeJsonParse<{
                projectMd: string;
                requirementsMd?: string;
                roadmapMd: string;
                stateMd: string;
            }>(resText);
            if (resJson && resJson.projectMd && resJson.roadmapMd && resJson.stateMd) {
                gsdData = {
                    projectMd: resJson.projectMd,
                    requirementsMd: resJson.requirementsMd || defaultGsdData.requirementsMd,
                    roadmapMd: resJson.roadmapMd,
                    stateMd: resJson.stateMd
                };
            }
        } catch (err) {
            console.error("GSD pre-generation failed, using default fallback:", err);
        }

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

        return NextResponse.json(project);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Failed to create project:", error);
        return NextResponse.json({ error: "Internal Server Error", details: message }, { status: 500 });
    }
}
