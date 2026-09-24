import { ScriptMode } from "./types";

export const EVENT_HANDLER_REGEX = /[\s\/]on[a-z]+\s*=\s*("([^"]*)"|'([^']*)'|[^\s>]+)/gi;

export function isJsonDataScript(scriptTag: string): boolean {
    const typeMatch = scriptTag.match(/\stype=(["'])(.*?)\1/i);
    const type = (typeMatch?.[2] || "").trim().toLowerCase();
    return ["application/ld+json", "application/json", "application/schema+json"].includes(type);
}

export function filterScripts(html: string, scriptMode: ScriptMode = "static"): string {
    if (scriptMode === "dynamic") return html;
    // Remove closed script tags (except JSON data scripts)
    let sanitized = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (scriptTag) => {
        return isJsonDataScript(scriptTag) ? scriptTag : "";
    });
    // Remove unclosed or self-closing script tags
    sanitized = sanitized.replace(/<script\b[^>]*\/?>/gi, (tag) => {
        return isJsonDataScript(tag) ? tag : "";
    });
    return sanitized;
}

export function stripEventHandlers(html: string): string {
    return html.replace(EVENT_HANDLER_REGEX, "");
}
