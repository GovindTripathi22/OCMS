import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { type ASTChange, type PatchReport } from "@/lib/ast-patcher";

function normalizeText(value: string): string {
    return value.split(/\s+/).filter(Boolean).join(" ").trim();
}

function mergeHtmlInlineStyles(existingStyle: string | undefined, newStyles: Record<string, string | undefined>): string {
    const styleMap = new Map<string, string>();
    if (existingStyle) {
        const declarations = existingStyle.split(";");
        for (const decl of declarations) {
            const colonIndex = decl.indexOf(":");
            if (colonIndex === -1) continue;
            const property = decl.slice(0, colonIndex).trim().toLowerCase();
            const val = decl.slice(colonIndex + 1).trim();
            if (property && val) {
                styleMap.set(property, val);
            }
        }
    }
    for (const [prop, val] of Object.entries(newStyles)) {
        // Convert camelCase style properties to kebab-case
        const propLower = prop.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`).toLowerCase();
        if (val === undefined) continue;
        if (val === null) {
            styleMap.delete(propLower);
        } else {
            styleMap.set(propLower, val);
        }
    }
    return Array.from(styleMap.entries())
        .map(([prop, val]) => `${prop}: ${val}`)
        .join("; ");
}

function getHtmlElementValue(el: cheerio.Cheerio<AnyNode>, type: "text" | "image" | "link" | "3d-model"): string | null {
    const fieldType = type.toLowerCase();
    if (fieldType === "image") {
        const targetImg = el.is("img") ? el : el.find("img").first();
        if (targetImg.length) return targetImg.attr("src") || null;
        const style = el.attr("style") || "";
        const urlMatch = style.match(/background(?:-image)?\s*:\s*url\(([^)]+)\)/i);
        if (urlMatch) {
            return urlMatch[1].replace(/['"]/g, "").trim();
        }
        return null;
    }
    if (fieldType === "link") {
        const targetLink = el.is("a") ? el : el.find("a").first();
        return targetLink.attr("href") || null;
    }
    if (fieldType === "3d-model") {
        const targetModel = el.is("model-viewer, modelviewer") ? el : el.find("model-viewer, modelviewer").first();
        return targetModel.attr("src") || null;
    }
    return el.text().trim();
}

function chooseHtmlTarget(
    $: cheerio.CheerioAPI,
    selector: string,
    change: ASTChange
): cheerio.Cheerio<AnyNode> | null {
    const candidates = $(selector);
    if (!candidates.length) return null;

    if (change.oldValue) {
        const normalizedOld = normalizeText(change.oldValue);
        for (let i = 0; i < candidates.length; i++) {
            const el = $(candidates[i]);
            const val = getHtmlElementValue(el, change.type);
            if (val !== null && normalizeText(val) === normalizedOld) {
                return el;
            }
        }
    }

    return $(candidates[0]);
}

export function patchHTML(sourceCode: string, changes: ASTChange[]): string {
    return patchHTMLWithReport(sourceCode, changes).code;
}

export function patchHTMLWithReport(sourceCode: string, changes: ASTChange[]): PatchReport {
    // Load with xmlMode: false to ensure we parse standard HTML correctly
    const $ = cheerio.load(sourceCode, { xmlMode: false }, false);
    let modified = false;
    let appliedCount = 0;
    const matchedSelectors = new Set<string>();
    const unmatchedSelectors = new Set<string>();

    for (const change of changes) {
        if (!change.selector || change.newValue === undefined || change.newValue === null) continue;

        const target = chooseHtmlTarget($, change.selector, change);
        if (!target || !target.length) {
            unmatchedSelectors.add(change.selector);
            continue;
        }

        modified = true;
        appliedCount++;
        matchedSelectors.add(change.selector);

        if (change.type === "text") {
            target.text(change.newValue);
        } else if (change.type === "image") {
            const targetImg = target.is("img") ? target : target.find("img").first();
            if (targetImg.length) {
                targetImg.attr("src", change.newValue);
                if (change.alt !== undefined) {
                    targetImg.attr("alt", change.alt);
                }
                const stylesToApply: Record<string, string | undefined> = {};
                if (change.objectFit !== undefined) stylesToApply.objectFit = change.objectFit;
                if (change.borderRadius !== undefined) stylesToApply.borderRadius = change.borderRadius;
                if (Object.keys(stylesToApply).length > 0) {
                    const updatedStyle = mergeHtmlInlineStyles(targetImg.attr("style"), stylesToApply);
                    targetImg.attr("style", updatedStyle);
                }
            } else {
                const stylesToApply: Record<string, string | undefined> = {
                    backgroundImage: `url(${change.newValue})`
                };
                if (change.objectFit !== undefined) stylesToApply.objectFit = change.objectFit;
                if (change.borderRadius !== undefined) stylesToApply.borderRadius = change.borderRadius;
                const updatedStyle = mergeHtmlInlineStyles(target.attr("style"), stylesToApply);
                target.attr("style", updatedStyle);
                if (change.alt !== undefined) {
                    target.attr("aria-label", change.alt);
                }
            }
        } else if (change.type === "link") {
            const targetLink = target.is("a") ? target : target.find("a").first();
            if (targetLink.length) {
                targetLink.attr("href", change.newValue);
            } else {
                target.attr("href", change.newValue);
            }
        } else if (change.type === "3d-model") {
            const targetModel = target.is("model-viewer, modelviewer") ? target : target.find("model-viewer, modelviewer").first();
            if (targetModel.length) {
                targetModel.attr("src", change.newValue);
                if (change.alt !== undefined) targetModel.attr("alt", change.alt);
                const stylesToApply: Record<string, string | undefined> = {};
                if (change.objectFit !== undefined) stylesToApply.objectFit = change.objectFit;
                if (change.borderRadius !== undefined) stylesToApply.borderRadius = change.borderRadius;
                if (Object.keys(stylesToApply).length > 0) {
                    const updatedStyle = mergeHtmlInlineStyles(targetModel.attr("style"), stylesToApply);
                    targetModel.attr("style", updatedStyle);
                }
            } else {
                target.attr("src", change.newValue);
                if (change.alt !== undefined) target.attr("alt", change.alt);
                const stylesToApply: Record<string, string | undefined> = {};
                if (change.objectFit !== undefined) stylesToApply.objectFit = change.objectFit;
                if (change.borderRadius !== undefined) stylesToApply.borderRadius = change.borderRadius;
                if (Object.keys(stylesToApply).length > 0) {
                    const updatedStyle = mergeHtmlInlineStyles(target.attr("style"), stylesToApply);
                    target.attr("style", updatedStyle);
                }
            }
        }
    }

    return {
        code: modified ? $.html() : sourceCode,
        appliedCount,
        matchedSelectors: Array.from(matchedSelectors),
        unmatchedSelectors: Array.from(unmatchedSelectors),
    };
}
