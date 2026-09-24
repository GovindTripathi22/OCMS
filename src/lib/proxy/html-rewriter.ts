import * as cheerio from "cheerio";
import { ScriptMode, SchemaField } from "./types";
import { toProxyUrl, rewriteSrcset, rewriteCssUrls } from "./url-resolver";
import { filterScripts, stripEventHandlers } from "./script-sanitizer";
import { createReferrerAndHistoryGuard } from "./client-bridge";

export function rewriteHtmlAssets(
    html: string,
    baseUrl: string,
    projectId?: string,
    scriptMode: ScriptMode = "static",
    nonce?: string
): string {
    let rewritten = html.replace(/<base[^>]*>/gi, "");

    // Strip pre-existing referrer meta tags to avoid conflicts
    rewritten = rewritten.replace(/<meta[^>]*name=["']referrer["'][^>]*>/gi, "");

    // Static mode strips executable scripts but preserves JSON data such as JSON-LD.
    // Dynamic mode keeps scripts and relies on the iframe sandbox plus history guard.
    rewritten = filterScripts(rewritten, scriptMode);
    rewritten = rewritten.replace(/\s(integrity|nonce)=("([^"]*)"|'([^']*)')/gi, "");
    if (scriptMode === "static") {
        rewritten = stripEventHandlers(rewritten);
    }

    // Inject meta referrer and CSS overrides inside <head> if present
    const referrerMeta = createReferrerAndHistoryGuard(baseUrl, projectId, scriptMode, nonce);
    if (/<head[^>]*>/i.test(rewritten)) {
        rewritten = rewritten.replace(/<head[^>]*>/i, (match) => `${match}${referrerMeta}`);
    } else {
        rewritten = `${referrerMeta}${rewritten}`;
    }

    rewritten = rewritten.replace(
        /\s(src|href|data-src|poster)=("([^"]*)"|'([^']*)')/gi,
        (_match, attr, _quoted, doubleValue, singleValue) => {
            const value = doubleValue ?? singleValue ?? "";
            const quote = doubleValue === undefined ? "'" : '"';
            return ` ${attr}=${quote}${toProxyUrl(value, baseUrl, projectId, scriptMode, nonce)}${quote}`;
        }
    );

    rewritten = rewritten.replace(
        /\saction=("([^"]*)"|'([^']*)')/gi,
        ' action="#"'
    );

    rewritten = rewritten.replace(
        /\s(srcset)=("([^"]*)"|'([^']*)')/gi,
        (_match, attr, _quoted, doubleValue, singleValue) => {
            const value = doubleValue ?? singleValue ?? "";
            const quote = doubleValue === undefined ? "'" : '"';
            return ` ${attr}=${quote}${rewriteSrcset(value, baseUrl, projectId, scriptMode, nonce)}${quote}`;
        }
    );

    rewritten = rewritten.replace(
        /\sstyle=("([^"]*)"|'([^']*)')/gi,
        (_match, _quoted, doubleValue, singleValue) => {
            const value = doubleValue ?? singleValue ?? "";
            const quote = doubleValue === undefined ? "'" : '"';
            return ` style=${quote}${rewriteCssUrls(value, baseUrl, projectId, scriptMode, nonce)}${quote}`;
        }
    );

    return rewritten;
}

export function patchHtmlWithSchema(html: string, schemaFields: SchemaField[]): string {
    if (!schemaFields || schemaFields.length === 0) return html;

    try {
        const $ = cheerio.load(html);
        let modified = false;

        for (const field of schemaFields) {
            if (!field.selector || !field.value) continue;
            let $el: ReturnType<typeof $>;
            try {
                $el = $(field.selector);
            } catch (selectorErr) {
                console.warn("[Proxy Schema Selector Error]:", field.selector, selectorErr);
                continue;
            }
            if ($el.length > 0) {
                if (field.type === "text") {
                    $el.text(field.value);
                    modified = true;
                } else if (field.type === "image") {
                    if ($el.is("img")) {
                        $el.attr("src", field.value);
                    } else {
                        $el.css("background-image", `url(${field.value})`);
                    }
                    modified = true;
                } else if (field.type === "link") {
                    $el.attr("href", field.value);
                    modified = true;
                }
            }
        }

        if (modified) {
            return $.html();
        }
    } catch (cheerioErr) {
        console.error("[Cheerio Patch Error]:", cheerioErr);
    }

    return html;
}
