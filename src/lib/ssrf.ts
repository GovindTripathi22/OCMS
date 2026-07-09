import dns from "dns";
import { promisify } from "util";
import { Agent, type Dispatcher } from "undici";

const dnsLookup = promisify(dns.lookup);

export interface SsrfValidationResult {
    safe: boolean;
    error?: string;
    resolvedIp?: string;
    family?: 4 | 6;
}

type RequestInitWithDispatcher = RequestInit & {
    dispatcher?: Dispatcher;
};

export function isPrivateIp(ip: string): boolean {
    try {
        let normalizedIp = ip;
        if (ip.startsWith("::ffff:")) {
            normalizedIp = ip.substring(7);
        }

        if (/^[0-9.]+$/.test(normalizedIp)) {
            const parts = normalizedIp.split(".").map(Number);
            if (parts.length === 4) {
                const [p1, p2, p3, p4] = parts;
                if (isNaN(p1) || isNaN(p2) || isNaN(p3) || isNaN(p4)) return true;
                if (p1 === 127) return true;
                if (p1 === 10) return true;
                if (p1 === 172 && p2 >= 16 && p2 <= 31) return true;
                if (p1 === 192 && p2 === 168) return true;
                if (p1 === 169 && p2 === 254) return true;
                if (p1 === 0) return true;
                if (p1 === 255 && p2 === 255 && p3 === 255 && p4 === 255) return true;
                return false;
            }
            return true;
        }

        const cleanIp = normalizedIp.toLowerCase().replace(/[\[\]]/g, "");

        if (cleanIp === "::1" || cleanIp === "0:0:0:0:0:0:0:1" || cleanIp === "::" || cleanIp === "0:0:0:0:0:0:0:0") return true;
        if (cleanIp.startsWith("fc") || cleanIp.startsWith("fd")) return true;
        if (cleanIp.startsWith("fe8") || cleanIp.startsWith("fe9") || cleanIp.startsWith("fea") || cleanIp.startsWith("feb")) return true;

        return false;
    } catch {
        return true;
    }
}

export async function validateUrlForSsrf(urlStr: string): Promise<SsrfValidationResult> {
    try {
        const isLocalAllowed = process.env.ALLOW_LOCAL_SSRF === "true";
        const parsedUrl = new URL(urlStr);

        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
            return { safe: false, error: "Only http and https protocols are supported" };
        }

        if (isLocalAllowed) {
            return { safe: true };
        }

        const hostname = parsedUrl.hostname.toLowerCase();
        if (
            hostname === "localhost" ||
            hostname === "127.0.0.1" ||
            hostname === "[::1]" ||
            hostname === "0.0.0.0"
        ) {
            return { safe: false, error: "Localhost and loopback URLs are blocked" };
        }

        try {
            const lookupResult = await dnsLookup(hostname, { all: true, verbatim: true });
            for (const addr of lookupResult) {
                if (isPrivateIp(addr.address)) {
                    return { safe: false, error: "Private or loopback IPs are blocked" };
                }
            }

            const approved = lookupResult[0];
            if (!approved) {
                return { safe: false, error: "Unable to resolve hostname" };
            }

            return {
                safe: true,
                resolvedIp: approved.address,
                family: approved.family === 6 ? 6 : 4,
            };
        } catch (dnsErr) {
            console.warn(`DNS lookup failed for ${hostname}:`, dnsErr);
            return { safe: false, error: "Unable to resolve hostname" };
        }
    } catch {
        return { safe: false, error: "Invalid URL format" };
    }
}

export async function fetchWithValidatedSsrfUrl(
    url: string,
    validation: SsrfValidationResult,
    init: RequestInit = {}
): Promise<Response> {
    if (!validation.safe) {
        throw new Error(validation.error || "Forbidden URL");
    }

    if (!validation.resolvedIp || !validation.family) {
        return fetch(url, init);
    }

    const dispatcher = new Agent({
        connect: {
            lookup(_hostname, _options, callback) {
                callback(null, validation.resolvedIp!, validation.family!);
            },
        },
    });

    return fetch(url, {
        ...init,
        dispatcher,
    } as RequestInitWithDispatcher);
}
