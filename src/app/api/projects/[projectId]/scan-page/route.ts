import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractFallbackSchemaFields } from "@/lib/scraper";
import { Prisma } from "@prisma/client";
import { getAuthorizedUser } from "@/auth";
import { validateUrlForSsrf } from "@/lib/ssrf";

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

        // Validate URL format and security via shared SSRF utility
        const validation = await validateUrlForSsrf(url);
        if (!validation.safe) {
            return NextResponse.json(
                { error: validation.error || "Forbidden URL" },
                { status: validation.error?.includes("blocked") ? 403 : 400 }
            );
        }

        // Fetch the page content if not provided
        let scrapedHtml = html || "";
        let finalUrl = targetUrl;

        if (!scrapedHtml) {
            try {
                const response = await fetch(targetUrl, {
                    redirect: "follow",
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        Accept: "text/html",
                    },
                    signal: AbortSignal.timeout(12000), // 12s timeout
                });

                if (!response.ok) {
                    throw new Error(`Server responded with status ${response.status}`);
                }

                scrapedHtml = await response.text();
                finalUrl = response.url;
            } catch (err: unknown) {
                console.error("[Scan Page Fetch Error]:", err);
                const errMsg = err instanceof Error ? err.message : String(err);
                return NextResponse.json({ error: `Failed to fetch page content: ${errMsg}` }, { status: 500 });
            }
        }

        // Generate schema fields via local scraper
        let newFields = extractFallbackSchemaFields(scrapedHtml, finalUrl);

        // Set path property on the new fields
        newFields = newFields.map((f) => ({
            ...f,
            path: pathname,
        }));

        const userId = await getAuthorizedUser();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const existingProject = await prisma.project.findFirst({
            where: {
                id: params.projectId,
                userId: userId
            }
        });

        if (!existingProject) {
            return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
        }

        let existingFields: Record<string, unknown>[] = [];
        if (existingProject.generatedSchema) {
            existingFields = existingProject.generatedSchema as unknown as Record<string, unknown>[];
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
