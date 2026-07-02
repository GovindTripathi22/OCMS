import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { Octokit } from "@octokit/rest";
import * as cheerio from "cheerio";
import crypto from "crypto";

// ---------- Types ----------

interface SchemaField {
    id: string;
    selector: string;
    type: string;
    value: string;
    [key: string]: unknown;
}

// ---------- Deterministic schema sync (replaces Gemini) ----------

/**
 * Extracts updated values for each schema field from the React/JSX source code.
 *
 * Strategy per field (first match wins):
 *   1. Cheerio CSS-selector lookup on the source treated as HTML-like markup.
 *      – text fields  → trimmed text content
 *      – image fields → `src` attribute
 *      – link  fields → `href` attribute
 *   2. Regex scan for JSX attribute values associated with the field's selector
 *      (e.g. className matching, id matching) followed by extracting nearby string
 *      literals / attribute values.
 *   3. Keep the existing value (nothing found → no change).
 */
function syncSchemaFromSource(
    sourceCode: string,
    currentSchema: SchemaField[],
): SchemaField[] {
    // Cheerio can partially parse JSX — it won't understand JS expressions but
    // will pick up static HTML-like tags and their attributes / text content.
    const $ = cheerio.load(sourceCode, { xmlMode: false });

    return currentSchema.map((field) => {
        const updated = { ...field };

        // --- Tier 1: Cheerio selector ---
        const extracted = extractViaCheerio($, field);
        if (extracted !== null) {
            updated.value = extracted;
            return updated;
        }

        // --- Tier 2: Regex fallback ---
        const regexResult = extractViaRegex(sourceCode, field);
        if (regexResult !== null) {
            updated.value = regexResult;
            return updated;
        }

        // --- Tier 3: Keep existing value ---
        return updated;
    });
}

/** Attempt to extract a value using Cheerio and the field's CSS selector. */
function extractViaCheerio(
    $: cheerio.CheerioAPI,
    field: SchemaField,
): string | null {
    try {
        const el = $(field.selector).first();
        if (el.length === 0) return null;

        const fieldType = (field.type || "").toLowerCase();

        if (fieldType === "image" || fieldType === "img") {
            const src = el.attr("src");
            return src && src.trim() ? src.trim() : null;
        }

        if (fieldType === "link" || fieldType === "url") {
            const href = el.attr("href");
            return href && href.trim() ? href.trim() : null;
        }

        // Default: text content
        const text = el.text().trim();
        return text.length > 0 ? text : null;
    } catch {
        // Invalid selector or Cheerio parse error — fall through.
        return null;
    }
}

/**
 * Regex-based fallback extractor.
 *
 * Tries several heuristics:
 *   a) If the field has a current value, look for that value as a string
 *      literal in the source and grab the surrounding context for an update.
 *   b) Look for JSX attributes (src, href, alt, className, id) near the
 *      selector hint and extract the adjacent string literal.
 */
function extractViaRegex(
    sourceCode: string,
    field: SchemaField,
): string | null {
    const fieldType = (field.type || "").toLowerCase();

    // --- Heuristic (a): selector-aware attribute extraction ---
    // Build a tag-level regex that looks for the selector as a className or id
    // and then extracts a relevant attribute value.
    const selectorHint = field.selector || "";

    // Extract class or id from the CSS selector (e.g. ".hero-title" → "hero-title")
    const classMatch = selectorHint.match(/\.([\w-]+)/);
    const idMatch = selectorHint.match(/#([\w-]+)/);
    const identifier = classMatch?.[1] || idMatch?.[1];

    if (identifier) {
        // Escape for use inside a regex
        const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        if (fieldType === "image" || fieldType === "img") {
            // Look for <img ... className="...identifier..." ... src="VALUE" ...>
            const imgRegex = new RegExp(
                `<img[^>]*(?:className|class)=["'][^"']*${escaped}[^"']*["'][^>]*src=["']([^"']+)["']`,
                "i",
            );
            const imgMatch = sourceCode.match(imgRegex);
            if (imgMatch?.[1]) return imgMatch[1];

            // Also try reversed attribute order: src before className
            const imgRegex2 = new RegExp(
                `<img[^>]*src=["']([^"']+)["'][^>]*(?:className|class)=["'][^"']*${escaped}[^"']*["']`,
                "i",
            );
            const imgMatch2 = sourceCode.match(imgRegex2);
            if (imgMatch2?.[1]) return imgMatch2[1];
        }

        if (fieldType === "link" || fieldType === "url") {
            const linkRegex = new RegExp(
                `<a[^>]*(?:className|class)=["'][^"']*${escaped}[^"']*["'][^>]*href=["']([^"']+)["']`,
                "i",
            );
            const linkMatch = sourceCode.match(linkRegex);
            if (linkMatch?.[1]) return linkMatch[1];
        }

        // For text fields — find the tag with the identifier and grab its inner text.
        // This handles patterns like: <h1 className="hero-title">Some text</h1>
        const textRegex = new RegExp(
            `<\\w+[^>]*(?:className|class)=["'][^"']*${escaped}[^"']*["'][^>]*>([^<]+)<`,
            "i",
        );
        const textMatch = sourceCode.match(textRegex);
        if (textMatch?.[1]?.trim()) return textMatch[1].trim();
    }

    // --- Heuristic (b): look for the old value as a string literal ---
    if (field.value && field.value.trim().length > 0) {
        const oldVal = field.value.trim();
        const escapedOld = oldVal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // Check if the old value still exists in source
        const stillPresent = new RegExp(escapedOld).test(sourceCode);
        if (stillPresent) {
            // Value unchanged — return current value (no update needed).
            return oldVal;
        }
    }

    return null;
}

// Verification function for GitHub Webhook Signature
function verifySignature(payload: string, signature: string, secret: string): boolean {
    const hmac = crypto.createHmac("sha256", secret);
    const digest = Buffer.from("sha256=" + hmac.update(payload).digest("hex"), "utf8");
    const sigBuffer = Buffer.from(signature, "utf8");
    return sigBuffer.length === digest.length && crypto.timingSafeEqual(sigBuffer, digest);
}

export async function POST(req: NextRequest) {
    try {
        const payloadText = await req.text();
        const signature = req.headers.get("x-hub-signature-256") || "";
        const event = req.headers.get("x-github-event") || "";

        // Enforce signature verification in production
        const secret = process.env.GITHUB_WEBHOOK_SECRET;
        const isProduction = process.env.NODE_ENV === "production";
        
        if (isProduction && !secret) {
            console.error("[Webhook Error]: GITHUB_WEBHOOK_SECRET is missing in production.");
            return NextResponse.json({ error: "Webhook secret configuration missing" }, { status: 500 });
        }

        if (secret && !verifySignature(payloadText, signature, secret)) {
            console.error("[Webhook Error]: Signature verification failed.");
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        if (event !== "push") {
            return NextResponse.json({ message: `Ignored event: ${event}` }, { status: 200 });
        }

        const payload = JSON.parse(payloadText);
        const repoFullName = payload.repository?.full_name; // e.g. "owner/repo"
        const ref = payload.ref || ""; // e.g. "refs/heads/main"
        const branch = ref.replace("refs/heads/", "");

        if (!repoFullName) {
            return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
        }

        const [repoOwner, repoName] = repoFullName.split("/");

        // Find projects linked to this repo
        const projects = await prisma.project.findMany({
            where: {
                githubOwner: { equals: repoOwner },
                githubRepo: { equals: repoName },
                githubBranch: { equals: branch },
            },
        });

        if (projects.length === 0) {
            return NextResponse.json({ message: "No matching projects found for this repository." }, { status: 200 });
        }

        // Get list of modified files in the push
        const modifiedFiles: string[] = [];
        if (payload.commits && Array.isArray(payload.commits)) {
            for (const commit of payload.commits) {
                if (commit.added) modifiedFiles.push(...commit.added);
                if (commit.modified) modifiedFiles.push(...commit.modified);
            }
        }

        console.log(`[Webhook Sync] Push on ${repoFullName}:${branch}. Modified files:`, modifiedFiles);

        let syncCount = 0;

        for (const project of projects) {
            if (!project.targetFilePath) continue;

            const isTargetModified = modifiedFiles.includes(project.targetFilePath);
            if (!isTargetModified) {
                console.log(`[Webhook Sync] Target file ${project.targetFilePath} not modified for project ${project.id}. Skipping.`);
                continue;
            }

            // Fetch GitHub access token from the user account
            const account = await prisma.account.findFirst({
                where: {
                    userId: project.userId,
                    provider: "github",
                },
            });

            // Use user's access token
            const token = account?.access_token;
            if (!token) {
                console.warn(`[Webhook Sync] No GitHub token found for user ${project.userId}. Skipping.`);
                continue;
            }

            const octokit = new Octokit({ auth: token });

            try {
                const { data: fileData } = await octokit.repos.getContent({
                    owner: repoOwner,
                    repo: repoName,
                    path: project.targetFilePath,
                    ref: branch,
                }) as { data: { type: string; content: string } };

                if (Array.isArray(fileData) || fileData.type !== "file") continue;

                const decodedContent = Buffer.from(fileData.content, "base64").toString("utf8");

                // Parse current schema fields
                const currentSchema = (project.generatedSchema as unknown[]) || [];
                if (currentSchema.length === 0) continue;

                // Deterministic local sync: extract updated values from the source code
                const updatedSchema = syncSchemaFromSource(
                    decodedContent,
                    currentSchema as SchemaField[],
                );

                // Update database
                await prisma.project.update({
                    where: { id: project.id },
                    data: {
                        generatedSchema: updatedSchema as unknown as Prisma.InputJsonValue,
                    },
                });

                console.log(`[Webhook Sync] Project ${project.id} updated schema successfully.`);
                syncCount++;

            } catch (err) {
                console.error(`[Webhook Sync Error] Failed to sync project ${project.id}:`, err);
            }
        }

        return NextResponse.json({
            success: true,
            syncedProjects: syncCount,
            totalMatchedProjects: projects.length,
        }, { status: 200 });

    } catch (err: unknown) {
        console.error("[Webhook Error]:", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: "Internal Server Error", details: errMsg }, { status: 500 });
    }
}
