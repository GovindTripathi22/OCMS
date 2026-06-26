import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import postcss, { type Declaration, type Rule } from "postcss";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StyleMap = Record<string, string>;
type ResponsiveVariant = "sm" | "md" | "lg";
type StyleBundle = Record<"base" | ResponsiveVariant, StyleMap>;

interface CssRule {
    selector: string;
    declarations: StyleMap;
    media?: ResponsiveVariant;
}

interface DomNode {
    type?: string;
    name?: string;
    data?: string;
    attribs?: Record<string, string>;
    children?: DomNode[];
}

interface RenderContext {
    $: cheerio.CheerioAPI;
    baseUrl: URL;
    rules: CssRule[];
    nodeCount: { value: number };
    maxNodes: number;
}

const SKIP_TAGS = new Set(["script", "style", "link", "meta", "noscript", "template", "source"]);
const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "param", "track", "wbr"]);
const SAFE_TAGS = new Set([
    "a", "article", "aside", "button", "div", "figure", "figcaption", "footer", "form", "h1", "h2", "h3", "h4",
    "h5", "h6", "header", "img", "input", "label", "li", "main", "nav", "ol", "p", "picture", "section",
    "span", "strong", "em", "small", "ul", "video",
]);

export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();

        if (!url || typeof url !== "string") {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        let targetUrl: URL;
        try {
            targetUrl = new URL(url);
        } catch {
            return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
        }

        const fetchRes = await fetch(targetUrl.href, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; OCMS-Bot/1.0)",
                Accept: "text/html,application/xhtml+xml",
            },
            signal: AbortSignal.timeout(12000),
        });

        if (!fetchRes.ok) {
            return NextResponse.json({ error: `Failed to fetch: ${fetchRes.status}` }, { status: 502 });
        }

        const html = await fetchRes.text();
        const $ = cheerio.load(html);
        const root = findProminentRoot($);
        const rootNode = root.get(0) as DomNode | undefined;

        if (!rootNode) {
            return NextResponse.json({ error: "No prominent section found" }, { status: 422 });
        }

        const context: RenderContext = {
            $,
            baseUrl: targetUrl,
            rules: await collectCssRules($, targetUrl),
            nodeCount: { value: 0 },
            maxNodes: 90,
        };

        const markup = renderNode(rootNode, context, 2);
        if (!markup) {
            return NextResponse.json({ error: "Unable to render component from selected section" }, { status: 422 });
        }

        return NextResponse.json({
            code: buildComponentCode(markup),
            sourceUrl: targetUrl.href,
            generatedAt: new Date().toISOString(),
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Component steal failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

function findProminentRoot($: cheerio.CheerioAPI): cheerio.Cheerio<unknown> {
    const directHero = $("[class*='hero'], [id*='hero'], [class*='banner'], [id*='banner'], [class*='masthead'], [id*='masthead']").first();
    if (directHero.length) return directHero;

    let best = $("body");
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const node of $("header, main, section, article, div").toArray()) {
        const score = scoreCandidate($, node as DomNode);
        if (score > bestScore) {
            bestScore = score;
            best = $(node);
        }
    }

    return best.length ? best : $("body");
}

function scoreCandidate($: cheerio.CheerioAPI, node: DomNode): number {
    const element = $(node as never);
    if (element.closest("footer, script, style, noscript").length) return Number.NEGATIVE_INFINITY;

    const tagName = String(element.prop("tagName") || "").toLowerCase();
    const identifier = `${element.attr("id") || ""} ${element.attr("class") || ""}`.toLowerCase();
    const text = cleanText(element.text());
    let score = Math.min(text.length, 600) / 12;

    if (identifier.includes("hero")) score += 120;
    if (identifier.includes("banner") || identifier.includes("masthead") || identifier.includes("landing")) score += 80;
    if (tagName === "header") score += 55;
    if (tagName === "main") score += 30;
    if (tagName === "section") score += 20;
    if (element.find("h1").length) score += 50;
    if (element.find("h2").length) score += 24;
    if (element.find("img, picture, video").length) score += 18;
    if (element.find("a, button, [role='button']").length) score += 16;
    if (element.find("section, article").length > 4) score -= 30;
    if (text.length < 20 && !element.find("img, picture, video").length) score -= 40;

    return score;
}

async function collectCssRules($: cheerio.CheerioAPI, baseUrl: URL): Promise<CssRule[]> {
    const rules: CssRule[] = [];

    $("style").each((_, node) => {
        appendCssRules($(node).html() || "", rules);
    });

    const stylesheetUrls = $("link[rel='stylesheet'][href]")
        .toArray()
        .map((node) => $(node).attr("href"))
        .filter((href): href is string => Boolean(href))
        .slice(0, 6);

    const stylesheetResults = await Promise.allSettled(stylesheetUrls.map((href) => fetchStylesheet(href, baseUrl)));
    for (const result of stylesheetResults) {
        if (result.status === "fulfilled") appendCssRules(result.value, rules);
    }

    return rules;
}

async function fetchStylesheet(href: string, baseUrl: URL): Promise<string> {
    const stylesheetUrl = new URL(href, baseUrl).href;
    const response = await fetch(stylesheetUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; OCMS-Bot/1.0)",
            Accept: "text/css,*/*;q=0.1",
        },
        signal: AbortSignal.timeout(5000),
    });

    return response.ok ? response.text() : "";
}

function appendCssRules(cssText: string, rules: CssRule[]): void {
    if (!cssText.trim()) return;

    try {
        const root = postcss.parse(cssText);
        root.walkRules((rule: Rule) => {
            const declarations = declarationsFromRule(rule);
            if (!Object.keys(declarations).length) return;

            for (const selector of splitSelectorList(rule.selector)) {
                const normalizedSelector = normalizeCssSelector(selector);
                if (normalizedSelector) {
                    rules.push({ selector: normalizedSelector, declarations, media: mediaVariantForRule(rule) });
                }
            }
        });
    } catch {
        // Malformed stylesheet chunks are ignored; inline styles and other stylesheets can still drive the clone.
    }
}

function declarationsFromRule(rule: Rule): StyleMap {
    const declarations: StyleMap = {};
    rule.walkDecls((decl: Declaration) => {
        if (!decl.prop || !decl.value) return;
        declarations[decl.prop.trim().toLowerCase()] = decl.value.trim();
    });
    return declarations;
}

function mediaVariantForRule(rule: Rule): ResponsiveVariant | undefined {
    let parent = rule.parent as { type?: string; name?: string; params?: string; parent?: unknown } | undefined;
    while (parent) {
        if (parent.type === "atrule" && parent.name === "media" && parent.params) {
            const width = readMinWidth(parent.params.toLowerCase());
            if (width !== null) {
                if (width >= 1024) return "lg";
                if (width >= 768) return "md";
                if (width >= 640) return "sm";
            }
        }
        parent = parent.parent as typeof parent;
    }
    return undefined;
}

function renderNode(node: DomNode, context: RenderContext, depth: number): string | null {
    if (node.type === "text") {
        const text = cleanText(node.data || "");
        return text ? escapeJSXText(text) : null;
    }

    if (node.type !== "tag" || !node.name || context.nodeCount.value >= context.maxNodes) return null;

    const rawTag = node.name.toLowerCase();
    if (SKIP_TAGS.has(rawTag)) return null;

    context.nodeCount.value++;
    const tagName = normalizeTagName(rawTag);
    const styles = computeStyles(context, node);
    const className = styleBundleToTailwind(styles, tagName, depth);
    const attrs = buildAttributes(context, node, tagName, className, styles.base);
    const indent = "    ".repeat(depth);

    if (VOID_TAGS.has(tagName)) {
        return `${indent}<${tagName}${attrs} />`;
    }

    const children = (node.children || [])
        .map((child) => renderNode(child, context, depth + 1))
        .filter((child): child is string => Boolean(child));

    if (!children.length) {
        return `${indent}<${tagName}${attrs}></${tagName}>`;
    }

    const inlineChildren = children.every((child) => !child.trimStart().startsWith("<") && !child.includes("\n"));
    if (inlineChildren) {
        return `${indent}<${tagName}${attrs}>${children.join(" ")}</${tagName}>`;
    }

    const childMarkup = children
        .map((child) => (child.trimStart().startsWith("<") ? child : `${"    ".repeat(depth + 1)}${child}`))
        .join("\n");

    return `${indent}<${tagName}${attrs}>\n${childMarkup}\n${indent}</${tagName}>`;
}

function computeStyles(context: RenderContext, node: DomNode): StyleBundle {
    const bundle: StyleBundle = { base: {}, sm: {}, md: {}, lg: {} };

    for (const rule of context.rules) {
        if (!elementMatchesSelector(context.$, node, rule.selector)) continue;
        Object.assign(rule.media ? bundle[rule.media] : bundle.base, rule.declarations);
    }

    Object.assign(bundle.base, parseInlineStyle(context.$(node as never).attr("style") || ""));
    return bundle;
}

function elementMatchesSelector($: cheerio.CheerioAPI, node: DomNode, selector: string): boolean {
    try {
        return $(selector).toArray().includes(node as never);
    } catch {
        return false;
    }
}

function buildAttributes(context: RenderContext, node: DomNode, tagName: string, className: string, styles: StyleMap): string {
    const element = context.$(node as never);
    const attrs: string[] = [];

    if (className) attrs.push(`className="${escapeAttribute(className)}"`);

    const id = element.attr("id");
    if (id) attrs.push(`id="${escapeAttribute(id)}"`);

    if (tagName === "a") {
        attrs.push(`href="${escapeAttribute(resolveUrl(element.attr("href") || "#", context.baseUrl))}"`);
    }

    if (tagName === "img" || tagName === "video") {
        const src = element.attr("src") || element.attr("data-src");
        if (src) attrs.push(`src="${escapeAttribute(resolveUrl(src, context.baseUrl))}"`);
        if (tagName === "img") attrs.push(`alt="${escapeAttribute(element.attr("alt") || "")}"`);
    }

    for (const attrName of ["role", "type", "aria-label", "aria-expanded", "aria-controls"]) {
        const value = element.attr(attrName);
        if (value) attrs.push(`${attrName}="${escapeAttribute(value)}"`);
    }

    const inlineStyles = inlineStyleObject(styles, context.baseUrl);
    if (Object.keys(inlineStyles).length) {
        const styleBody = Object.entries(inlineStyles)
            .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
            .join(", ");
        attrs.push(`style={{ ${styleBody} }}`);
    }

    return attrs.length ? ` ${attrs.join(" ")}` : "";
}

function styleBundleToTailwind(bundle: StyleBundle, tagName: string, depth: number): string {
    const classes = [
        ...semanticDefaults(tagName, depth),
        ...styleMapToTailwind(bundle.base, undefined, true),
        ...styleMapToTailwind(bundle.sm, "sm", false),
        ...styleMapToTailwind(bundle.md, "md", false),
        ...styleMapToTailwind(bundle.lg, "lg", false),
    ];

    if (depth === 2 && !classes.some((className) => className.startsWith("w-"))) classes.unshift("w-full");
    return dedupe(classes).join(" ");
}

function semanticDefaults(tagName: string, depth: number): string[] {
    if (tagName === "h1") return ["text-4xl", "md:text-6xl", "font-bold", "leading-tight"];
    if (tagName === "h2") return ["text-3xl", "md:text-4xl", "font-bold", "leading-tight"];
    if (tagName === "p") return ["text-base", "leading-relaxed"];
    if (tagName === "a" || tagName === "button") return ["inline-flex", "items-center", "justify-center"];
    if (tagName === "img" || tagName === "video") return ["max-w-full", "object-cover"];
    if (depth === 2) return ["relative"];
    return [];
}

function styleMapToTailwind(styles: StyleMap, prefix: ResponsiveVariant | undefined, adaptive: boolean): string[] {
    const classes: string[] = [];
    const add = (className?: string | null) => {
        if (className) classes.push(prefix ? `${prefix}:${className}` : className);
    };
    const addRaw = (className?: string | null) => {
        if (className) classes.push(className);
    };

    if (styles.display === "flex" || styles.display === "inline-flex") {
        add(styles.display === "inline-flex" ? "inline-flex" : "flex");
        if (!prefix && adaptive && styles["flex-direction"] === "row") {
            addRaw("flex-col");
            addRaw("md:flex-row");
        } else if (styles["flex-direction"] === "column") {
            add("flex-col");
        } else if (styles["flex-direction"] === "row") {
            add("flex-row");
        }
        if (styles["flex-wrap"] === "wrap") add("flex-wrap");
    } else if (styles.display === "grid") {
        add("grid");
        const columns = gridColumnCount(styles["grid-template-columns"]);
        if (!prefix && adaptive && columns && columns > 1) {
            addRaw("grid-cols-1");
            if (columns > 2) addRaw("sm:grid-cols-2");
            addRaw(`md:grid-cols-${Math.min(columns, 12)}`);
        } else if (columns) {
            add(`grid-cols-${Math.min(columns, 12)}`);
        }
    } else if (styles.display === "inline-block") {
        add("inline-block");
    }

    add(alignItemsClass(styles["align-items"]));
    add(justifyContentClass(styles["justify-content"]));
    add(textAlignClass(styles["text-align"]));
    add(positionClass(styles.position));
    add(objectFitClass(styles["object-fit"]));
    add(spacingClass("gap", styles.gap));
    add(sizeClass("w", styles.width));
    add(sizeClass("max-w", styles["max-width"]));
    add(sizeClass("min-h", styles["min-height"]));
    add(colorClass("bg", styles["background-color"]));
    add(colorClass("text", styles.color));
    add(borderRadiusClass(styles["border-radius"]));
    add(borderWidthClass(styles["border-width"] || borderWidthFromShorthand(styles.border)));
    add(colorClass("border", styles["border-color"] || borderColorFromShorthand(styles.border)));
    add(fontWeightClass(styles["font-weight"]));
    add(fontSizeClass(styles["font-size"]));

    addSpacingClasses(classes, styles, "padding", "p", prefix);
    addSpacingClasses(classes, styles, "margin", "m", prefix);

    if (styles["background-size"] === "cover") add("bg-cover");
    if (styles["background-size"] === "contain") add("bg-contain");
    if (styles["background-position"]?.includes("center")) add("bg-center");
    if (styles["text-transform"] === "uppercase") add("uppercase");

    return classes;
}

function addSpacingClasses(classes: string[], styles: StyleMap, property: "padding" | "margin", prefixChar: "p" | "m", prefix?: ResponsiveVariant): void {
    const box = expandBox(styles, property);
    if (!box) return;

    const add = (className: string | null) => {
        if (className) classes.push(prefix ? `${prefix}:${className}` : className);
    };
    const [top, right, bottom, left] = box;

    if (top === right && right === bottom && bottom === left) {
        add(spacingClass(prefixChar, top));
        return;
    }

    if (top === bottom) {
        add(spacingClass(`${prefixChar}y`, top));
    } else {
        add(spacingClass(`${prefixChar}t`, top));
        add(spacingClass(`${prefixChar}b`, bottom));
    }

    if (right === left) {
        add(spacingClass(`${prefixChar}x`, right));
    } else {
        add(spacingClass(`${prefixChar}r`, right));
        add(spacingClass(`${prefixChar}l`, left));
    }
}

function expandBox(styles: StyleMap, property: "padding" | "margin"): [string, string, string, string] | null {
    const shorthand = styles[property];
    const parts = shorthand ? splitCssValue(shorthand) : [];
    let box: [string, string, string, string] | null = null;

    if (parts.length === 1) box = [parts[0], parts[0], parts[0], parts[0]];
    if (parts.length === 2) box = [parts[0], parts[1], parts[0], parts[1]];
    if (parts.length === 3) box = [parts[0], parts[1], parts[2], parts[1]];
    if (parts.length >= 4) box = [parts[0], parts[1], parts[2], parts[3]];

    const top = styles[`${property}-top`];
    const right = styles[`${property}-right`];
    const bottom = styles[`${property}-bottom`];
    const left = styles[`${property}-left`];

    if (!box && (top || right || bottom || left)) box = [top || "0", right || "0", bottom || "0", left || "0"];
    if (!box) return null;

    return [top || box[0], right || box[1], bottom || box[2], left || box[3]];
}

function parseInlineStyle(styleValue: string): StyleMap {
    const declarations: StyleMap = {};
    if (!styleValue.trim()) return declarations;

    try {
        const root = postcss.parse(`a{${styleValue}}`);
        root.walkDecls((decl: Declaration) => {
            declarations[decl.prop.trim().toLowerCase()] = decl.value.trim();
        });
    } catch {
        for (const declaration of styleValue.split(";")) {
            const colon = declaration.indexOf(":");
            if (colon === -1) continue;
            const property = declaration.slice(0, colon).trim().toLowerCase();
            const value = declaration.slice(colon + 1).trim();
            if (property && value) declarations[property] = value;
        }
    }

    return declarations;
}

function inlineStyleObject(styles: StyleMap, baseUrl: URL): Record<string, string> {
    const inlineStyles: Record<string, string> = {};
    const backgroundImage = styles["background-image"] || readBackgroundImageFromShorthand(styles.background);
    const imageUrl = backgroundImage ? extractCssUrl(backgroundImage) : null;

    if (imageUrl) inlineStyles.backgroundImage = `url(${resolveUrl(imageUrl, baseUrl)})`;
    if (styles["box-shadow"] && styles["box-shadow"] !== "none") inlineStyles.boxShadow = styles["box-shadow"];

    return inlineStyles;
}

function splitSelectorList(selector: string): string[] {
    const parts: string[] = [];
    let buffer = "";
    let bracketDepth = 0;
    let parenDepth = 0;
    let quote: string | null = null;

    for (const char of selector) {
        if (quote) {
            buffer += char;
            if (char === quote) quote = null;
            continue;
        }
        if (char === "\"" || char === "'") {
            quote = char;
            buffer += char;
            continue;
        }
        if (char === "[") bracketDepth++;
        if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
        if (char === "(") parenDepth++;
        if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
        if (char === "," && bracketDepth === 0 && parenDepth === 0) {
            if (buffer.trim()) parts.push(buffer.trim());
            buffer = "";
            continue;
        }
        buffer += char;
    }

    if (buffer.trim()) parts.push(buffer.trim());
    return parts;
}

function normalizeCssSelector(selector: string): string | null {
    if (!selector || selector.includes("::")) return null;

    const cleaned = selector
        .replace(/:(hover|focus|active|visited|focus-visible|focus-within|disabled|enabled|checked|first-child|last-child|first-of-type|last-of-type)/g, "")
        .replace(/:not\([^)]*\)/g, "")
        .trim();

    if (!cleaned || cleaned.includes("@") || cleaned.length > 280) return null;
    return cleaned;
}

function normalizeTagName(tagName: string): string {
    if (SAFE_TAGS.has(tagName)) return tagName;
    if (tagName === "b") return "strong";
    if (tagName === "i") return "em";
    return "div";
}

function readMinWidth(params: string): number | null {
    const index = params.indexOf("min-width");
    if (index === -1) return null;
    const colon = params.indexOf(":", index);
    if (colon === -1) return null;
    const closing = params.indexOf(")", colon);
    return parseCssLength(params.slice(colon + 1, closing === -1 ? undefined : closing).trim());
}

function spacingClass(prefix: string, value?: string): string | null {
    if (!value || value === "auto") return null;
    const token = spacingToken(value);
    return token ? `${prefix}-${token}` : null;
}

function spacingToken(value: string): string | null {
    const px = parseCssLength(value);
    if (px === null) return `[${sanitizeArbitrary(value)}]`;
    if (px === 0) return "0";
    if (px === 1) return "px";

    const scale = px / 4;
    if (Number.isInteger(scale) && scale >= 0 && scale <= 96) return String(scale);
    return `[${sanitizeArbitrary(value)}]`;
}

function sizeClass(prefix: string, value?: string): string | null {
    if (!value || value === "auto") return null;
    if (value === "100%") return `${prefix}-full`;
    if (value === "100vw" || value === "100vh") return `${prefix}-screen`;
    return `${prefix}-[${sanitizeArbitrary(value)}]`;
}

function parseCssLength(value: string): number | null {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "0") return 0;
    const numberValue = Number.parseFloat(trimmed);
    if (!Number.isFinite(numberValue)) return null;
    if (trimmed.endsWith("px")) return numberValue;
    if (trimmed.endsWith("rem") || trimmed.endsWith("em")) return numberValue * 16;
    return null;
}

function gridColumnCount(value?: string): number | null {
    if (!value) return null;
    const repeatMatch = value.match(/repeat\(\s*(\d+)\s*,/);
    if (repeatMatch) return Number.parseInt(repeatMatch[1], 10);
    const parts = splitCssValue(value).filter(Boolean);
    return parts.length > 1 ? parts.length : null;
}

function splitCssValue(value: string): string[] {
    const parts: string[] = [];
    let buffer = "";
    let parenDepth = 0;

    for (const char of value.trim()) {
        if (char === "(") parenDepth++;
        if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
        if (/\s/.test(char) && parenDepth === 0) {
            if (buffer) parts.push(buffer);
            buffer = "";
            continue;
        }
        buffer += char;
    }

    if (buffer) parts.push(buffer);
    return parts;
}

function alignItemsClass(value?: string): string | null {
    if (value === "center") return "items-center";
    if (value === "flex-start" || value === "start") return "items-start";
    if (value === "flex-end" || value === "end") return "items-end";
    if (value === "stretch") return "items-stretch";
    return null;
}

function justifyContentClass(value?: string): string | null {
    if (value === "center") return "justify-center";
    if (value === "flex-start" || value === "start") return "justify-start";
    if (value === "flex-end" || value === "end") return "justify-end";
    if (value === "space-between") return "justify-between";
    if (value === "space-around") return "justify-around";
    if (value === "space-evenly") return "justify-evenly";
    return null;
}

function textAlignClass(value?: string): string | null {
    if (value === "center") return "text-center";
    if (value === "left" || value === "start") return "text-left";
    if (value === "right" || value === "end") return "text-right";
    return null;
}

function positionClass(value?: string): string | null {
    return value === "relative" || value === "absolute" || value === "fixed" || value === "sticky" ? value : null;
}

function objectFitClass(value?: string): string | null {
    if (value === "cover") return "object-cover";
    if (value === "contain") return "object-contain";
    if (value === "fill") return "object-fill";
    if (value === "none") return "object-none";
    return null;
}

function borderRadiusClass(value?: string): string | null {
    if (!value) return null;
    if (value === "0" || value === "0px") return "rounded-none";
    if (value === "9999px" || value === "50%") return "rounded-full";
    const px = parseCssLength(value);
    if (px === 4) return "rounded";
    if (px === 6) return "rounded-md";
    if (px === 8) return "rounded-lg";
    if (px === 12) return "rounded-xl";
    if (px === 16) return "rounded-2xl";
    return `rounded-[${sanitizeArbitrary(value)}]`;
}

function borderWidthClass(value?: string): string | null {
    if (!value || value === "0" || value === "0px") return null;
    const px = parseCssLength(value);
    if (px === 1) return "border";
    if (px === 2) return "border-2";
    if (px === 4) return "border-4";
    return `border-[${sanitizeArbitrary(value)}]`;
}

function fontWeightClass(value?: string): string | null {
    if (!value) return null;
    const numeric = Number.parseInt(value, 10);
    if (value === "bold" || numeric >= 700) return "font-bold";
    if (numeric >= 600) return "font-semibold";
    if (numeric >= 500) return "font-medium";
    if (value === "normal" || numeric === 400) return "font-normal";
    return null;
}

function fontSizeClass(value?: string): string | null {
    if (!value) return null;
    const px = parseCssLength(value);
    if (px === null) return `text-[${sanitizeArbitrary(value)}]`;
    if (px <= 12) return "text-xs";
    if (px <= 14) return "text-sm";
    if (px <= 16) return "text-base";
    if (px <= 18) return "text-lg";
    if (px <= 20) return "text-xl";
    if (px <= 24) return "text-2xl";
    if (px <= 30) return "text-3xl";
    if (px <= 36) return "text-4xl";
    if (px <= 48) return "text-5xl";
    if (px <= 60) return "text-6xl";
    return `text-[${sanitizeArbitrary(value)}]`;
}

function colorClass(prefix: "bg" | "text" | "border", value?: string): string | null {
    if (!value || value === "transparent" || value === "inherit" || value === "currentcolor") return null;
    const color = normalizeColor(value);
    return color ? `${prefix}-[${color}]` : null;
}

function normalizeColor(value: string): string | null {
    const trimmed = value.trim().toLowerCase();
    const named: Record<string, string> = { black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", blue: "#0000ff" };
    if (named[trimmed]) return named[trimmed];
    if (trimmed.startsWith("#")) return trimmed.length === 4 ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}` : trimmed.slice(0, 7);
    if (trimmed.startsWith("rgb")) return rgbToHex(trimmed);
    return null;
}

function rgbToHex(value: string): string | null {
    const open = value.indexOf("(");
    const close = value.lastIndexOf(")");
    if (open === -1 || close === -1) return null;
    const parts = value.slice(open + 1, close).replace(/\//g, ",").split(/[\s,]+/).filter(Boolean).slice(0, 3).map((part) => Number.parseInt(part, 10));
    if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) return null;
    return `#${parts.map((part) => Math.max(0, Math.min(255, part)).toString(16).padStart(2, "0")).join("")}`;
}

function borderWidthFromShorthand(value?: string): string | undefined {
    return value ? splitCssValue(value).find((part) => parseCssLength(part) !== null) : undefined;
}

function borderColorFromShorthand(value?: string): string | undefined {
    return value ? splitCssValue(value).find((part) => part.startsWith("#") || part.startsWith("rgb") || /^[a-z]+$/i.test(part)) : undefined;
}

function readBackgroundImageFromShorthand(value?: string): string | undefined {
    const url = value ? extractCssUrl(value) : null;
    return url ? `url(${url})` : undefined;
}

function extractCssUrl(value: string): string | null {
    const start = value.indexOf("url(");
    if (start === -1) return null;
    const contentStart = start + "url(".length;
    const contentEnd = value.indexOf(")", contentStart);
    if (contentEnd === -1) return null;
    return stripQuotes(value.slice(contentStart, contentEnd).trim());
}

function resolveUrl(value: string, baseUrl: URL): string {
    if (!value || value.startsWith("#") || value.startsWith("mailto:") || value.startsWith("tel:")) return value || "#";
    try {
        return new URL(value, baseUrl).href;
    } catch {
        return value;
    }
}

function stripQuotes(value: string): string {
    const first = value[0];
    const last = value[value.length - 1];
    return (first === "\"" || first === "'") && first === last ? value.slice(1, -1) : value;
}

function sanitizeArbitrary(value: string): string {
    return value.trim().replace(/\s+/g, "_").replace(/[;{}]/g, "");
}

function cleanText(text: string): string {
    return text.replace(/\s+/g, " ").trim();
}

function escapeJSXText(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/{/g, "&#123;")
        .replace(/}/g, "&#125;");
}

function escapeAttribute(value: string): string {
    return escapeJSXText(value).replace(/"/g, "&quot;");
}

function dedupe(values: string[]): string[] {
    return Array.from(new Set(values.filter(Boolean)));
}

function buildComponentCode(markup: string): string {
    return `import React from "react";

export default function StolenComponent() {
    return (
${markup}
    );
}
`;
}
