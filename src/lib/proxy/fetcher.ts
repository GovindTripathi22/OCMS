import { NextRequest } from "next/server";

export const MAX_HTML_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_CSS_BYTES = 2 * 1024 * 1024;  // 2MB
export const MAX_ASSET_BYTES = 10 * 1024 * 1024; // 10MB

export async function readBoundedBody(
    response: Response,
    maxBytes: number
): Promise<{ buffer: Buffer | null; exceeded: boolean }> {
    const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
    if (contentLength > maxBytes) {
        return { buffer: null, exceeded: true };
    }

    const reader = response.body?.getReader();
    if (!reader) {
        const arrayBuf = await response.arrayBuffer();
        if (arrayBuf.byteLength > maxBytes) {
            return { buffer: null, exceeded: true };
        }
        return { buffer: Buffer.from(arrayBuf), exceeded: false };
    }

    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
            receivedBytes += value.length;
            if (receivedBytes > maxBytes) {
                try {
                    await reader.cancel();
                } catch {}
                return { buffer: null, exceeded: true };
            }
            chunks.push(value);
        }
    }
    return { buffer: Buffer.concat(chunks), exceeded: false };
}

export function corsHeaders(req: NextRequest): Record<string, string> {
    const origin = req.headers.get("origin");
    if (!origin) return {};

    const host = req.headers.get("host");
    const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL;
    const allowedHosts = new Set<string>();

    if (host) allowedHosts.add(host.toLowerCase());
    if (appUrl) {
        try {
            allowedHosts.add(new URL(appUrl).host.toLowerCase());
        } catch {}
    }
    if (process.env.NODE_ENV !== "production") {
        allowedHosts.add("localhost:3000");
        allowedHosts.add("127.0.0.1:3000");
    }

    try {
        const parsed = new URL(origin);
        if (allowedHosts.has(parsed.host.toLowerCase())) {
            return {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                Vary: "Origin",
            };
        }
    } catch {}

    return {};
}
