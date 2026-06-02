import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanHtml, extractFallbackSchemaFields, validateSchemaFields } from "@/lib/scraper";
import { generateSchema } from "@/lib/gemini";
import { Prisma } from "@prisma/client";

export async function POST(
    req: NextRequest,
    { params }: { params: { projectId: string } }
) {
    try {
        const { url, html } = await req.json();

        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        const targetUrl = url;
        let pathname = "/";
        try {
            const parsed = new URL(url);
            pathname = parsed.pathname;
        } catch {
            return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
        }

        // Fetch the page content if not provided
        let scrapedHtml = html || "";
        let finalUrl = targetUrl;

        if (!scrapedHtml) {
            try {
                let response = await fetch(targetUrl, {
                    redirect: "manual",
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        Accept: "text/html",
                    },
                    signal: AbortSignal.timeout(12000), // 12s timeout
                });

                let currentUrl = new URL(targetUrl);
                let redirectCount = 0;
                const maxRedirects = 5;

                while ([301, 302, 303, 307, 308].includes(response.status) && redirectCount < maxRedirects) {
                    const location = response.headers.get("location");
                    if (!location) break;

                    const nextUrl = new URL(location, currentUrl.href);
                    if (nextUrl.origin !== currentUrl.origin) {
                        console.log(`Blocking cross-origin redirect during page scanning from ${currentUrl.origin} to ${nextUrl.origin}`);
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

                scrapedHtml = await response.text();
                finalUrl = currentUrl.href;
            } catch (err: unknown) {
                console.error("[Scan Page Fetch Error]:", err);
                const errMsg = err instanceof Error ? err.message : String(err);
                return NextResponse.json({ error: `Failed to fetch page content: ${errMsg}` }, { status: 500 });
            }
        }

        // Generate schema fields via Gemini or Fallback
        let newFields = [];
        try {
            const cleanResult = cleanHtml(scrapedHtml);
            const aiSchemaFields = await generateSchema(cleanResult.html, finalUrl);
            newFields = validateSchemaFields(scrapedHtml, aiSchemaFields, finalUrl);
        } catch (aiErr) {
            console.warn("[AI Scan failed, using fallback scraper]:", aiErr);
            newFields = extractFallbackSchemaFields(scrapedHtml, finalUrl);
        }

        if (newFields.length === 0) {
            newFields = extractFallbackSchemaFields(scrapedHtml, finalUrl);
        }

        // Set path property on the new fields
        newFields = newFields.map((f) => ({
            ...f,
            path: pathname,
        }));

        // Fetch current project schema
        const project = await prisma.project.findUnique({
            where: { id: params.projectId },
            select: { generatedSchema: true },
        });

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        let existingFields: Record<string, unknown>[] = [];
        if (project.generatedSchema) {
            existingFields = project.generatedSchema as unknown as Record<string, unknown>[];
        }

        // Filter out old fields for the current path to replace them with fresh ones
        const preservedFields = existingFields.filter((f: Record<string, unknown>) => {
            const fPath = f.path || "/";
            return fPath !== pathname;
        });

        const mergedSchema = [...preservedFields, ...newFields];

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
            newFieldsCount: newFields.length,
        });

    } catch (error: unknown) {
        console.error("Scan page error:", error);
        const errMsg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: "Internal Server Error", details: errMsg }, { status: 500 });
    }
}
