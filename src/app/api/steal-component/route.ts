import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import postcss, { type Declaration, type Rule } from "postcss";

export const runtime = "nodejs";

type StyleMap = Record<string, string>;
type ResponsiveVariant = "sm" | "md" | "lg";

/*
type StyleBundle = {
    base: StyleMap;
    sm: StyleMap;
    md: StyleMap;
    lg: StyleMap;
};
*/

interface CssRule {
    selector: string;
    declarations: StyleMap;
    order: number;
    media?: ResponsiveVariant;
}

interface RenderContext {
    $: cheerio.CheerioAPI;
    baseUrl: URL;
    rules: CssRule[];
    nodeCount: { value: number };
    maxNodes: number;
}



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
        const rules = await collectCssRules($, targetUrl);
        const root = findProminentRoot($);
        const rootNode = root.get(0);

        if (!rootNode) {
            return NextResponse.json({ error: "No prominent section found" }, { status: 422 });
        }

        const context: RenderContext = {
            $,
            baseUrl: targetUrl,
            rules,
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
    const candidates = $("header, main, section, article, div").toArray();

    for (const node of candidates) {
        const score = scoreCandidate($, node);
        if (score > bestScore) {
            bestScore = score;
            best = $(node);
        }
    }

    return best.length ? best : $("body");
}

function scoreCandidate($: cheerio.CheerioAPI, node: unknown): number {
    const element = $(node as never);
    if (element.closest("footer, script, style, noscript").length) return Number.NEGATIVE_INFINITY;

    const tagName = String(element.prop("tagName") || "").toLowerCase();
    const identifier = `${element.attr("id") || ""} ${element.attr("class") || ""}`.toLowerCase();
    const text = cleanText(element.text());
    const textLength = Math.min(text.length, 600);

    let score = textLength / 12;
    if (identifier.includes("hero")) score += 120;
    if (identifier.includes("banner") || identifier.includes("masthead") || identifier.includes("landing")) score += 80;
    if (tagName === "header") score += 55;
    if (tagName === "main") score += 30;
    if (tagName === "section") score += 20;
    if (element.find("h1").length) score += 50;
    if (element.find("h2").length) score += 24;
    if (element.find("img, picture, video").length) score += 18;
    if (element.find("a, button, [role='button']").length) score += 16;
    if (element.parents("main, body").length) score += 4;
    if (element.find("section, article").length > 4) score -= 30;
    if (text.length < 20 && !element.find("img, picture, video").length) score -= 40;

    return score;
}
async function collectCssRules($: cheerio.CheerioAPI, baseUrl: URL): Promise<CssRule[]> {
    const rules: CssRule[] = [];
    const order = { value: 0 };

    $("style").each((_, node) => {
        appendCssRules($(node).html() || "", rules, order);
    });

    const stylesheetUrls = $("link[rel='stylesheet'][href]")
        .toArray()
        .map((node) => $(node).attr("href"))
        .filter((href): href is string => Boolean(href))
        .slice(0, 6);

    const stylesheetResults = await Promise.allSettled(
        stylesheetUrls.map((href) => fetchStylesheet(href, baseUrl))
    );

    for (const result of stylesheetResults) {
        if (result.status === "fulfilled") appendCssRules(result.value, rules, order);
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

    if (!response.ok) return "";
    return response.text();
}

function appendCssRules(cssText: string, rules: CssRule[], order: { value: number }): void {
    if (!cssText.trim()) return;

    try {
        const root = postcss.parse(cssText);
        root.walkRules((rule: Rule) => {
            const declarations = declarationsFromRule(rule);
            if (!Object.keys(declarations).length) return;

            for (const selector of splitSelectorList(rule.selector)) {
                const normalizedSelector = normalizeCssSelector(selector);
                if (!normalizedSelector) continue;

                rules.push({
                    selector: normalizedSelector,
                    declarations,
                    media: mediaVariantForRule(rule),
                    order: order.value++,
                });
            }
        });
    } catch {
        // Ignore malformed stylesheet chunks; inline styles and other stylesheets can still drive the clone.
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parent: any = rule.parent;
    while (parent) {
        if (parent.type === "atrule" && parent.name === "media") {
            const params = parent.params.toLowerCase();
            const width = readMinWidth(params);
            if (width !== null) {
                if (width >= 1024) return "lg";
                if (width >= 768) return "md";
                if (width >= 640) return "sm";
            }
        }
        parent = parent.parent;
    }
    return undefined;
}

function readMinWidth(params: string): number | null {
    const marker = "min-width";
    const index = params.indexOf(marker);
    if (index === -1) return null;
    const colon = params.indexOf(":", index);
    if (colon === -1) return null;
    const closing = params.indexOf(")", colon);
    const value = params.slice(colon + 1, closing === -1 ? undefined : closing).trim();
    return parseCssLength(value);
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

/*
function computeStyles(context: RenderContext, node: unknown): StyleBundle {
    const bundle: StyleBundle = { base: {}, sm: {}, md: {}, lg: {} };

    for (const rule of context.rules) {
        if (!elementMatchesSelector(context.$, node, rule.selector)) continue;
        Object.assign(rule.media ? bundle[rule.media] : bundle.base, rule.declarations);
    }

    Object.assign(bundle.base, parseInlineStyle(context.$(node as never).attr("style") || ""));
    return bundle;
}

function elementMatchesSelector($: cheerio.CheerioAPI, node: unknown, selector: string): boolean {
    try {
        return $(selector).toArray().includes(node as never);
    } catch {
        return false;
    }
}
*/

/*
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
*/

function cleanText(text: string): string {
    return text.replace(/\s+/g, " ").trim();
}

function parseCssLength(value: string): number | null {
    const num = parseFloat(value);
    if (isNaN(num)) return null;
    if (value.endsWith("rem") || value.endsWith("em")) return num * 16;
    return num;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderNode(node: any, context: RenderContext, indent: number): string {
    if (context.nodeCount.value++ > context.maxNodes) return "";
    
    if (node.type === "text") {
        const txt = node.data.trim();
        if (!txt) return "";
        return txt.replace(/[{}]/g, (m: string) => `{'${m}'}`);
    }
    
    if (node.type !== "tag") return "";

    const $node = context.$(node);
    const tagName = node.name.toLowerCase();
    
    if (["script", "style", "link", "meta", "noscript"].includes(tagName)) return "";

    const indentStr = " ".repeat(indent);
    const attrs: string[] = [];
    
    const className = $node.attr("class");
    if (className) {
        attrs.push(`className="${className.trim()}"`);
    }

    for (const [name, val] of Object.entries(node.attribs || {})) {
        if (name === "class") continue;
        if (name === "style") continue;
        if (name.startsWith("on")) continue;
        attrs.push(`${name}="${val}"`);
    }

    const attrStr = attrs.length ? " " + attrs.join(" ") : "";

    if (["img", "br", "hr", "input", "meta"].includes(tagName)) {
        return `${indentStr}<${tagName}${attrStr} />`;
    }

    const childrenMarkup: string[] = [];
    $node.contents().each((_, child) => {
        const m = renderNode(child, context, indent + 2);
        if (m) childrenMarkup.push(m);
    });

    if (childrenMarkup.length === 0) {
        return `${indentStr}<${tagName}${attrStr}></${tagName}>`;
    }

    return `${indentStr}<${tagName}${attrStr}>\n${childrenMarkup.join("\n")}\n${indentStr}</${tagName}>`;
}

function buildComponentCode(markup: string): string {
    return `"use client";\n\nimport React from "react";\n\nexport default function StolenComponent() {\n    return (\n${markup}\n    );\n}\n`;
}
