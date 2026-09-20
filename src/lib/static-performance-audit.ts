import * as cheerio from "cheerio";

export interface AuditIssue {
    severity: "error" | "warning" | "info";
    category: "performance" | "accessibility" | "seo";
    title: string;
    description: string;
}

export interface StaticAuditResult {
    auditType: "LOCAL_STATIC_AUDIT";
    scores: {
        performance: number;
        accessibility: number;
        seo: number;
    };
    issues: AuditIssue[];
    passedChecks: string[];
    metrics: {
        domElementCount: number;
        imageCount: number;
        scriptCount: number;
        linkCount: number;
    };
}

/**
 * Runs a deterministic local static performance, accessibility, and SEO audit on HTML content.
 * Zero AI, zero random numbers, zero simulation.
 */
export function runLocalStaticAudit(html: string): StaticAuditResult {
    const $ = cheerio.load(html);
    const issues: AuditIssue[] = [];
    const passedChecks: string[] = [];

    let perfDeductions = 0;
    let a11yDeductions = 0;
    let seoDeductions = 0;

    // 1. DOM Size Check
    const allElements = $("*");
    const domCount = allElements.length;
    if (domCount > 1200) {
        perfDeductions += 25;
        issues.push({
            severity: "error",
            category: "performance",
            title: "Excessive DOM size",
            description: `Page contains ${domCount} elements. High DOM depth degrades rendering and interaction performance.`,
        });
    } else if (domCount > 800) {
        perfDeductions += 10;
        issues.push({
            severity: "warning",
            category: "performance",
            title: "Large DOM size",
            description: `Page contains ${domCount} elements. Consider virtualizing large lists or components.`,
        });
    } else {
        passedChecks.push(`Reasonable DOM element count (${domCount} elements)`);
    }

    // 2. Synchronous & Render-blocking scripts
    const scripts = $("script:not([type='application/ld+json']):not([type='application/json'])");
    let syncScriptCount = 0;
    scripts.each((_, el) => {
        const src = $(el).attr("src");
        const isAsync = $(el).attr("async") !== undefined;
        const isDefer = $(el).attr("defer") !== undefined;
        const isModule = $(el).attr("type") === "module";
        if (src && !isAsync && !isDefer && !isModule) {
            syncScriptCount++;
        }
    });

    if (syncScriptCount > 0) {
        perfDeductions += Math.min(30, syncScriptCount * 8);
        issues.push({
            severity: "warning",
            category: "performance",
            title: "Render-blocking scripts detected",
            description: `Found ${syncScriptCount} synchronous external script(s). Add defer or async attributes to prevent parser blocking.`,
        });
    } else {
        passedChecks.push("Zero render-blocking synchronous external scripts");
    }

    // 3. Images: Missing Alt and Missing Dimensions
    const images = $("img");
    let missingAltCount = 0;
    let missingDimensionsCount = 0;

    images.each((_, el) => {
        const alt = $(el).attr("alt");
        const width = $(el).attr("width");
        const height = $(el).attr("height");
        const style = $(el).attr("style") || "";

        if (alt === undefined || alt === null || alt.trim() === "") {
            missingAltCount++;
        }
        if (!width && !height && !style.includes("width") && !style.includes("aspect-ratio")) {
            missingDimensionsCount++;
        }
    });

    if (missingAltCount > 0) {
        a11yDeductions += Math.min(35, missingAltCount * 10);
        issues.push({
            severity: "error",
            category: "accessibility",
            title: "Images missing alt text",
            description: `${missingAltCount} image(s) lack an alt attribute, which prevents screen readers from understanding visual content.`,
        });
    } else if (images.length > 0) {
        passedChecks.push("All images contain descriptive alt attributes");
    }

    if (missingDimensionsCount > 0) {
        perfDeductions += Math.min(15, missingDimensionsCount * 4);
        issues.push({
            severity: "warning",
            category: "performance",
            title: "Images missing explicit dimensions",
            description: `${missingDimensionsCount} image(s) do not define width or height, which causes layout shifts (CLS).`,
        });
    } else if (images.length > 0) {
        passedChecks.push("Images have defined dimensions or aspect-ratio");
    }

    // 4. Links: Missing text or insecure protocols
    const links = $("a");
    let emptyLinksCount = 0;
    let insecureProtocolCount = 0;

    links.each((_, el) => {
        const text = $(el).text().trim();
        const href = $(el).attr("href") || "";
        const ariaLabel = $(el).attr("aria-label");

        if (!text && !ariaLabel && $(el).find("img[alt], svg").length === 0) {
            emptyLinksCount++;
        }

        if (href.toLowerCase().startsWith("javascript:")) {
            insecureProtocolCount++;
        }
    });

    if (emptyLinksCount > 0) {
        a11yDeductions += Math.min(20, emptyLinksCount * 5);
        issues.push({
            severity: "error",
            category: "accessibility",
            title: "Empty link labels",
            description: `${emptyLinksCount} link(s) have no discernible text or aria-label for assistive technologies.`,
        });
    } else if (links.length > 0) {
        passedChecks.push("All links have discernible text or accessible labels");
    }

    if (insecureProtocolCount > 0) {
        issues.push({
            severity: "error",
            category: "accessibility",
            title: "Insecure javascript: links",
            description: `${insecureProtocolCount} link(s) use the unsafe javascript: pseudo-protocol.`,
        });
    }

    // 5. SEO Basics: title, meta description, viewport
    const title = $("title").text().trim();
    if (!title) {
        seoDeductions += 30;
        issues.push({
            severity: "error",
            category: "seo",
            title: "Missing <title> tag",
            description: "Document does not have a <title> element in the head.",
        });
    } else if (title.length < 10) {
        seoDeductions += 10;
        issues.push({
            severity: "warning",
            category: "seo",
            title: "Short <title> tag",
            description: `Document title is only ${title.length} characters long. Aim for 30-60 characters for search engines.`,
        });
    } else {
        passedChecks.push(`Document title defined ("${title.slice(0, 30)}...")`);
    }

    const metaDescription = $("meta[name='description']").attr("content")?.trim();
    if (!metaDescription) {
        seoDeductions += 20;
        issues.push({
            severity: "warning",
            category: "seo",
            title: "Missing meta description",
            description: "Page lacks a <meta name=\"description\"> tag for search results summaries.",
        });
    } else {
        passedChecks.push("Meta description tag present");
    }

    const viewport = $("meta[name='viewport']").attr("content")?.trim();
    if (!viewport) {
        perfDeductions += 15;
        seoDeductions += 20;
        issues.push({
            severity: "error",
            category: "seo",
            title: "Missing mobile viewport meta tag",
            description: "Page does not define <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">.",
        });
    } else {
        passedChecks.push("Mobile viewport configured properly");
    }

    // Compute final non-negative scores (0-100)
    const performance = Math.max(20, Math.min(100, 100 - perfDeductions));
    const accessibility = Math.max(20, Math.min(100, 100 - a11yDeductions));
    const seo = Math.max(20, Math.min(100, 100 - seoDeductions));

    return {
        auditType: "LOCAL_STATIC_AUDIT",
        scores: { performance, accessibility, seo },
        issues,
        passedChecks,
        metrics: {
            domElementCount: domCount,
            imageCount: images.length,
            scriptCount: scripts.length,
            linkCount: links.length,
        },
    };
}
