import dns from "dns";
import { promisify } from "util";

const dnsLookup = promisify(dns.lookup);

export function isPrivateIp(ip: string): boolean {
    try {
        // Handle IPv4-mapped IPv6 addresses, e.g. ::ffff:127.0.0.1
        let normalizedIp = ip;
        if (ip.startsWith("::ffff:")) {
            normalizedIp = ip.substring(7);
        }

        // IPv4 validation
        if (/^[0-9.]+$/.test(normalizedIp)) {
            const parts = normalizedIp.split(".").map(Number);
            if (parts.length === 4) {
                const [p1, p2, p3, p4] = parts;
                if (isNaN(p1) || isNaN(p2) || isNaN(p3) || isNaN(p4)) return true;
                // Loopback: 127.0.0.0/8
                if (p1 === 127) return true;
                // Private Class A: 10.0.0.0/8
                if (p1 === 10) return true;
                // Private Class B: 172.16.0.0/12
                if (p1 === 172 && p2 >= 16 && p2 <= 31) return true;
                // Private Class C: 192.168.0.0/16
                if (p1 === 192 && p2 === 168) return true;
                // Link-local: 169.254.0.0/16
                if (p1 === 169 && p2 === 254) return true;
                // Unspecified / any: 0.0.0.0/8
                if (p1 === 0) return true;
                // Broadcast: 255.255.255.255
                if (p1 === 255 && p2 === 255 && p3 === 255 && p4 === 255) return true;
                return false;
            }
            return true;
        }

        // IPv6 validation
        const cleanIp = normalizedIp.toLowerCase().replace(/[\[\]]/g, "");

        // Loopback and unspecified: ::1, ::
        if (cleanIp === "::1" || cleanIp === "0:0:0:0:0:0:0:1" || cleanIp === "::" || cleanIp === "0:0:0:0:0:0:0:0") return true;

        // Unique Local Address (fc00::/7)
        if (cleanIp.startsWith("fc") || cleanIp.startsWith("fd")) return true;

        // Link-local (fe80::/10)
        if (cleanIp.startsWith("fe8") || cleanIp.startsWith("fe9") || cleanIp.startsWith("fea") || cleanIp.startsWith("feb")) return true;

        return false;
    } catch {
        return true; // If parsing fails, treat it as private/unsafe
    }
}

export async function validateUrlForSsrf(urlStr: string): Promise<{ safe: boolean; error?: string }> {
    try {
        const isLocalAllowed = process.env.NODE_ENV === "development" || process.env.ALLOW_LOCAL_SSRF === "true";
        if (isLocalAllowed) {
            return { safe: true };
        }

        const parsedUrl = new URL(urlStr);
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
            return { safe: false, error: "Only http and https protocols are supported" };
        }

        const hostname = parsedUrl.hostname.toLowerCase();
        
        // Initial hostname check
        if (
            hostname === "localhost" ||
            hostname === "127.0.0.1" ||
            hostname === "[::1]" ||
            hostname === "0.0.0.0"
        ) {
            return { safe: false, error: "Localhost and loopback URLs are blocked in production" };
        }

        // Resolve DNS to verify all potential IPs associated with this host
        try {
            const lookupResult = await dnsLookup(hostname, { all: true });
            for (const addr of lookupResult) {
                if (isPrivateIp(addr.address)) {
                    return { safe: false, error: "Private or loopback IPs are blocked in production" };
                }
            }
        } catch (dnsErr) {
            console.warn(`DNS lookup failed for ${hostname}:`, dnsErr);
            return { safe: false, error: "Unable to resolve hostname" };
        }

        return { safe: true };
    } catch {
        return { safe: false, error: "Invalid URL format" };
    }
}
