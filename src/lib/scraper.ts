import * as cheerio from "cheerio";
import type { SchemaField } from "@/types/schema";


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

type CheerioRoot = ReturnType<typeof cheerio.load>;
type CheerioSelection = ReturnType<CheerioRoot>;

const EDITABLE_TEXT_TAGS = "h1,h2,h3,h4,h5,h6,p,a,button,li,span,strong,em,blockquote,figcaption";

function normalizeValue(value: string): string {
    return value.replace(/\s+/g, " ").trim();
}

function attrEscape(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function slugify(value: string): string {
    return normalizeValue(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "content-field";
}

function titleize(value: string): string {
    return value
        .split("-")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function extractCssUrl(styleValue = ""): string {
    const match = styleValue.match(/background(?:-image)?:\s*url\((["']?)(.*?)\1\)/i);
    return match?.[2] ?? "";
}

function getFieldValue(element: CheerioSelection, type: SchemaField["type"]): string {
    if (type === "image") {
        if (element.is("img")) {
            return element.attr("src") || element.attr("data-src") || "";
        }
        return extractCssUrl(element.attr("style"));
    }

    if (type === "link") {
        const anchor = element.is("a") ? element : element.closest("a");
        return anchor.attr("href") || "";
    }

    return normalizeValue(element.text());
}

function valuesMatch(actual: string, expected: string, baseUrl?: string): boolean {
    const normalizedActual = normalizeValue(actual);
    const normalizedExpected = normalizeValue(expected);
    if (!normalizedActual || !normalizedExpected) return false;
    if (normalizedActual === normalizedExpected) return true;

    if (baseUrl) {
        try {
            return new URL(normalizedActual, baseUrl).href === new URL(normalizedExpected, baseUrl).href;
        } catch {
            return false;
        }
    }

    return false;
}

function selectorMatchesUnique($: CheerioRoot, selector: string): boolean {
    try {
        return $(selector).length === 1;
    } catch {
        return false;
    }
}

function nthOfTypeSelector($: CheerioRoot, element: CheerioSelection): string {
    const parts: string[] = [];
    let current = element;

    while (current.length && current[0]?.type === "tag") {
        const tagName = current.prop("tagName")?.toLowerCase();
        if (!tagName || tagName === "html") break;

        const id = current.attr("id");
        if (id && selectorMatchesUnique($, `[id="${attrEscape(id)}"]`)) {
            parts.unshift(`${tagName}[id="${attrEscape(id)}"]`);
            break;
        }

        const sameTypeSiblings = current.parent().children(tagName);
        const index = sameTypeSiblings.index(current) + 1;
        parts.unshift(`${tagName}:nth-of-type(${Math.max(index, 1)})`);

        if (tagName === "body") break;
        current = current.parent();
    }

    return parts.join(" > ");
}

function buildPreciseSelector($: CheerioRoot, element: CheerioSelection): string {
    const tagName = element.prop("tagName")?.toLowerCase() || "*";
    const id = element.attr("id");
    if (id) {
        const idSelector = `[id="${attrEscape(id)}"]`;
        if (selectorMatchesUnique($, idSelector)) return idSelector;
        const tagIdSelector = `${tagName}${idSelector}`;
        if (selectorMatchesUnique($, tagIdSelector)) return tagIdSelector;
    }

    const stableAttrs = ["aria-label", "data-heading", "data-title", "data-slot", "name", "role"];
    for (const attr of stableAttrs) {
        const value = element.attr(attr);
        if (!value) continue;
        const selector = `${tagName}[${attr}="${attrEscape(value)}"]`;
        if (selectorMatchesUnique($, selector)) return selector;
    }

    const classes = (element.attr("class") || "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 4);

    for (const className of classes) {
        const selector = `${tagName}[class~="${attrEscape(className)}"]`;
        if (selectorMatchesUnique($, selector)) return selector;
    }

    if (classes.length > 1) {
        const selector = `${tagName}${classes.map((className) => `[class~="${attrEscape(className)}"]`).join("")}`;
        if (selectorMatchesUnique($, selector)) return selector;
    }

    return nthOfTypeSelector($, element);
}

function findElementByValue($: CheerioRoot, field: SchemaField, baseUrl?: string): CheerioSelection | null {
    const selector = field.type === "image" ? "img,[style*='background']" : field.type === "link" ? "a[href]" : EDITABLE_TEXT_TAGS;
    let matched: CheerioSelection | null = null;

    $(selector).each((_, el) => {
        if (matched) return;
        const element = $(el);
        const actual = getFieldValue(element, field.type);
        if (valuesMatch(actual, field.value, baseUrl)) {
            matched = element;
        }
    });

    return matched;
}

/**
 * Validates and repairs AI-generated selectors against the fetched HTML.
 * Invalid selectors are discarded unless the same value can be found in the DOM.
 */
export function validateSchemaFields(
    rawHtml: string,
    fields: SchemaField[],
    baseUrl?: string
): SchemaField[] {
    const $ = cheerio.load(rawHtml);
    const usedIds = new Set<string>();

    return fields.reduce<SchemaField[]>((validFields, field) => {
        if (!field || !field.value || !field.type || !field.selector) return validFields;
        if (!["text", "image", "link", "list", "3d-model"].includes(field.type)) return validFields;

        let element: CheerioSelection | null = null;
        try {
            const selected = $(field.selector).first();
            if (selected.length) {
                const actual = getFieldValue(selected, field.type);
                if (valuesMatch(actual, field.value, baseUrl)) {
                    element = selected;
                }
            }
        } catch {
            element = null;
        }

        element ??= findElementByValue($, field, baseUrl);
        if (!element || !element.length) return validFields;

        const selector = buildPreciseSelector($, element);
        const actualValue = getFieldValue(element, field.type);
        const baseId = slugify(field.id || field.label || actualValue);
        let id = baseId;
        let duplicateIndex = 2;
        while (usedIds.has(id)) {
            id = `${baseId}-${duplicateIndex}`;
            duplicateIndex++;
        }
        usedIds.add(id);

        validFields.push({
            ...field,
            id,
            label: field.label || titleize(id),
            value: actualValue || field.value,
            originalHtmlTag: element.prop("tagName")?.toLowerCase() || field.originalHtmlTag || "div",
            selector,
        });

        return validFields;
    }, []);
}

export function extractFallbackSchemaFields(
    rawHtml: string,
    baseUrl?: string,
    limit = 150
): SchemaField[] {
    const $ = cheerio.load(rawHtml);
    const fields: SchemaField[] = [];
    const usedIds = new Set<string>();

    function addField(element: CheerioSelection, type: SchemaField["type"], idHint: string, labelHint: string) {
        if (fields.length >= limit) return;
        const value = getFieldValue(element, type);
        if (!value || normalizeValue(value).length < 2) return;

        const selector = buildPreciseSelector($, element);
        if (!selector) return;

        const baseId = slugify(idHint || value);
        let id = baseId;
        let duplicateIndex = 2;
        while (usedIds.has(id)) {
            id = `${baseId}-${duplicateIndex}`;
            duplicateIndex++;
        }
        usedIds.add(id);

        fields.push({
            id,
            type,
            label: labelHint || titleize(id),
            value: type === "text" || type === "list" ? normalizeValue(value) : value,
            originalHtmlTag: element.prop("tagName")?.toLowerCase() || "div",
            selector,
        });
    }

    // Scan all heading levels h1-h6
    $("h1,h2,h3,h4,h5,h6").each((_, el) => {
        const element = $(el);
        addField(element, "text", `${element.prop("tagName")?.toLowerCase()}-${element.text()}`, "Heading");
    });

    // Scan text blocks: paragraphs, blockquotes, list items, spans, labels, and cells
    $("p,blockquote,figcaption,li,label,span,strong,em,th,td").each((_, el) => {
        const element = $(el);
        const value = normalizeValue(element.text());
        // For standard body copy tags, allow text with length >= 10. For smaller tags, allow length >= 2
        const minLength = ["p", "blockquote", "figcaption"].includes(element.prop("tagName")?.toLowerCase() || "") ? 10 : 2;
        if (value.length >= minLength && element.children().length <= 3) {
            addField(element, "text", value, "Text Block");
        }
    });

    // Scan semantic and custom buttons and links
    $("button, a, .btn, .button, [role='button'], [class*='btn-'], [class*='button-']").each((_, el) => {
        const element = $(el);
        const value = normalizeValue(element.text());
        if (!value) return;
        if (element.is("a") && element.attr("href")) {
            addField(element, "link", value, `${value} Link`);
        } else {
            addField(element, "text", value, `${value} Button`);
        }
    });

    // Scan images
    $("img[src],img[data-src],[style*='background']").each((_, el) => {
        const element = $(el);
        addField(element, "image", element.attr("alt") || getFieldValue(element, "image"), "Image");
    });

    return validateSchemaFields(rawHtml, fields, baseUrl).slice(0, limit);
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
        reductionPercent: originalLength > 0
            ? Math.round(((originalLength - cleanedHtml.length) / originalLength) * 100)
            : 0,
        elementsRemoved,
    };
}
