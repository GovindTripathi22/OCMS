import { ScriptMode } from "./types";

export const PROXY_PATH = "/api/proxy?url=";

export function isSkippableUrl(value: string): boolean {
    const trimmed = value.trim();
    return (
        !trimmed ||
        trimmed.startsWith("#") ||
        trimmed.startsWith("data:") ||
        trimmed.startsWith("blob:") ||
        trimmed.startsWith("mailto:") ||
        trimmed.startsWith("tel:") ||
        trimmed.startsWith(PROXY_PATH)
    );
}

export function toProxyUrl(
    value: string,
    baseUrl: string,
    projectId?: string,
    scriptMode: ScriptMode = "static",
    nonce?: string
): string {
    if (value.trim().toLowerCase().startsWith("javascript:")) return "#";
    if (isSkippableUrl(value)) return value;

    try {
        const absoluteUrl = new URL(value, baseUrl).toString();
        let proxyUrl = `${PROXY_PATH}${encodeURIComponent(absoluteUrl)}`;
        if (projectId) {
            proxyUrl += `&projectId=${encodeURIComponent(projectId)}`;
        }
        if (scriptMode === "dynamic") {
            proxyUrl += `&scriptMode=dynamic`;
        }
        if (nonce) {
            proxyUrl += `&nonce=${encodeURIComponent(nonce)}`;
        }
        return proxyUrl;
    } catch {
        return value;
    }
}

export function rewriteSrcset(
    value: string,
    baseUrl: string,
    projectId?: string,
    scriptMode: ScriptMode = "static",
    nonce?: string
): string {
    return value
        .split(",")
        .map((entry) => {
            const parts = entry.trim().split(/\s+/);
            if (!parts[0]) return entry;
            return [toProxyUrl(parts[0], baseUrl, projectId, scriptMode, nonce), ...parts.slice(1)].join(" ");
        })
        .join(", ");
}

export function rewriteCssUrls(
    css: string,
    baseUrl: string,
    projectId?: string,
    scriptMode: ScriptMode = "static",
    nonce?: string
): string {
    return css.replace(/url\((['"]?)(?!data:|blob:|#)([^'")]+)\1\)/gi, (_match, quote, assetUrl) => {
        return `url(${quote}${toProxyUrl(assetUrl, baseUrl, projectId, scriptMode, nonce)}${quote})`;
    });
}
