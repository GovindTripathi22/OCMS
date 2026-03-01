import * as cheerio from "cheerio";

/**
 * Rigorous HTML cleaning utility for OCMS.
 *
 * Strips all non-structural elements to minimize token count before
 * sending to Gemini for schema generation.
 */

/** Tags that contribute zero semantic value and waste tokens */
const STRIP_TAGS = [
    "script",
    "style",
    "svg",
    "iframe",
    "noscript",
    "link[rel='stylesheet']",
    "link[rel='preload']",
    "link[rel='prefetch']",
    "link[rel='dns-prefetch']",
    "link[rel='preconnect']",
    "meta",
    "head > title",
    "picture > source",
] as const;

/** Tracking / analytics attributes to remove */
const STRIP_ATTRIBUTES = [
    "data-gtm",
    "data-ga",
    "data-analytics",
    "data-track",
    "data-testid",
    "data-cy",
    "data-test",
    "onclick",
    "onload",
    "onerror",
    "onscroll",
    "onmouseover",
    "onmouseout",
    "onfocus",
    "onblur",
] as const;

/** Class name patterns that indicate tracking or framework noise */
const NOISE_CLASS_PATTERNS = [
    /^js-/,
    /^gtm-/,
    /^ga-/,
    /^tracking-/,
    /^analytics-/,
];

export interface CleanResult {
    html: string;
    originalLength: number;
    cleanedLength: number;
    reductionPercent: number;
    elementsRemoved: number;
}

/**
 * Takes raw HTML and returns a clean, minified string representing
 * only the structural DOM and text content.
 */
export function cleanHtml(rawHtml: string): CleanResult {
    const originalLength = rawHtml.length;
    const $ = cheerio.load(rawHtml);
    let elementsRemoved = 0;

    // ── Phase 1: Remove junk tags ──────────────────────────
    for (const selector of STRIP_TAGS) {
        const matched = $(selector);
        elementsRemoved += matched.length;
        matched.remove();
    }

    // ── Phase 2: Remove tracking attributes ────────────────
    $("*").each((_, el) => {
        const element = $(el);

        for (const attr of STRIP_ATTRIBUTES) {
            if (element.attr(attr) !== undefined) {
                element.removeAttr(attr);
            }
        }

        // Remove attributes starting with data-gtm, data-ga, etc.
        const allAttrs = (el as unknown as { attribs: Record<string, string> }).attribs || {};
        for (const attrName of Object.keys(allAttrs)) {
            if (
                attrName.startsWith("data-gtm") ||
                attrName.startsWith("data-ga") ||
                attrName.startsWith("data-analytics") ||
                attrName.startsWith("data-track")
            ) {
                element.removeAttr(attrName);
            }
        }

        // Clean noisy class names
        const classAttr = element.attr("class");
        if (classAttr) {
            const cleanedClasses = classAttr
                .split(/\s+/)
                .filter(
                    (cls) => !NOISE_CLASS_PATTERNS.some((pattern) => pattern.test(cls))
                );
            if (cleanedClasses.length > 0) {
                element.attr("class", cleanedClasses.join(" "));
            } else {
                element.removeAttr("class");
            }
        }
    });

    // ── Phase 3: Remove empty containers ───────────────────
    $("div, span, section, article, aside, header, footer, nav").each(
        (_, el) => {
            const element = $(el);
            if (
                element.children().length === 0 &&
                (element.text() || "").trim() === ""
            ) {
                elementsRemoved++;
                element.remove();
            }
        }
    );

    // ── Phase 4: Remove HTML comments ─────────────────────
    $("*")
        .contents()
        .each((_, node) => {
            if (node.type === "comment") {
                $(node).remove();
                elementsRemoved++;
            }
        });

    // ── Phase 5: Minify and extract body ───────────────────
    const bodyHtml = $("body").html();
    const cleanedHtml = (bodyHtml || $.html())
        .replace(/\s{2,}/g, " ") // collapse whitespace
        .replace(/>\s+</g, "><") // remove whitespace between tags
        .trim();

    return {
        html: cleanedHtml,
        originalLength,
        cleanedLength: cleanedHtml.length,
        reductionPercent: Math.round(
            ((originalLength - cleanedHtml.length) / originalLength) * 100
        ),
        elementsRemoved,
    };
}
