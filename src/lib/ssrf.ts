import dns from "dns";
import { promisify } from "util";
import net from "net";
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

interface Ipv4Cidr {
    net: number;
    mask: number;
    description: string;
}

interface Ipv6Cidr {
    net: bigint;
    mask: bigint;
    description: string;
}

// Complete CIDR Block Tables
const IPV4_BLOCKED_CIDRS: Ipv4Cidr[] = [
    parseIpv4Cidr("0.0.0.0/8", "Current network (RFC 791)"),
    parseIpv4Cidr("10.0.0.0/8", "Private-use (RFC 1918)"),
    parseIpv4Cidr("100.64.0.0/10", "Shared address space / Carrier-grade NAT (RFC 6598)"),
    parseIpv4Cidr("127.0.0.0/8", "Loopback (RFC 1122)"),
    parseIpv4Cidr("169.254.0.0/16", "Link-local (RFC 3927)"),
    parseIpv4Cidr("172.16.0.0/12", "Private-use (RFC 1918)"),
    parseIpv4Cidr("192.0.0.0/24", "IETF protocol assignments (RFC 6890)"),
    parseIpv4Cidr("192.0.2.0/24", "TEST-NET-1 documentation (RFC 5737)"),
    parseIpv4Cidr("192.88.99.0/24", "6to4 relay anycast (RFC 7526)"),
    parseIpv4Cidr("192.168.0.0/16", "Private-use (RFC 1918)"),
    parseIpv4Cidr("198.18.0.0/15", "Network benchmark tests (RFC 2544)"),
    parseIpv4Cidr("198.51.100.0/24", "TEST-NET-2 documentation (RFC 5737)"),
    parseIpv4Cidr("203.0.113.0/24", "TEST-NET-3 documentation (RFC 5737)"),
    parseIpv4Cidr("224.0.0.0/4", "Multicast (RFC 5771)"),
    parseIpv4Cidr("240.0.0.0/4", "Reserved for future use (RFC 1112)"),
    parseIpv4Cidr("255.255.255.255/32", "Limited broadcast (RFC 8190)"),
];

const IPV6_BLOCKED_CIDRS: Ipv6Cidr[] = [
    parseIpv6Cidr("::/128", "Unspecified address"),
    parseIpv6Cidr("::1/128", "Loopback address"),
    parseIpv6Cidr("::ffff:0:0/96", "IPv4-mapped IPv6"),
    parseIpv6Cidr("64:ff9b::/96", "IPv4-IPv6 translation"),
    parseIpv6Cidr("100::/64", "Discard prefix"),
    parseIpv6Cidr("2001::/23", "IETF protocol assignments"),
    parseIpv6Cidr("2001:db8::/32", "Documentation prefix"),
    parseIpv6Cidr("2002::/16", "6to4 prefix"),
    parseIpv6Cidr("fc00::/7", "Unique local / private address"),
    parseIpv6Cidr("fe80::/10", "Link-local unicast"),
    parseIpv6Cidr("ff00::/8", "Multicast"),
];

function parseIpv4Cidr(cidr: string, description: string): Ipv4Cidr {
    const [ip, bitsStr] = cidr.split("/");
    const bits = parseInt(bitsStr, 10);
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    const net = (ipv4ToUint32(ip) & mask) >>> 0;
    return { net, mask, description };
}

function parseIpv6Cidr(cidr: string, description: string): Ipv6Cidr {
    const [ip, bitsStr] = cidr.split("/");
    const bits = parseInt(bitsStr, 10);
    const mask = bits === 0 ? BigInt(0) : ((BigInt(1) << BigInt(128)) - BigInt(1)) ^ ((BigInt(1) << BigInt(128 - bits)) - BigInt(1));
    const net = ipv6ToBigInt(ip) & mask;
    return { net, mask, description };
}

export function ipv4ToUint32(ip: string): number {
    const parts = ip.split(".").map((p) => parseInt(p, 10));
    return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
}

export function ipv6ToBigInt(ip: string): bigint {
    let cleanIp = ip.toLowerCase();
    if (cleanIp.startsWith("[") && cleanIp.endsWith("]")) {
        cleanIp = cleanIp.slice(1, -1);
    }

    if (cleanIp.includes(".")) {
        // Handle IPv4-mapped IPv6 like ::ffff:192.168.1.1
        const lastColon = cleanIp.lastIndexOf(":");
        const v4Part = cleanIp.slice(lastColon + 1);
        const v4Num = ipv4ToUint32(v4Part);
        const prefix = cleanIp.slice(0, lastColon);
        return (ipv6ToBigInt(prefix + ":0:0") & (BigInt("0xffffffffffffffffffffffff00000000"))) | BigInt(v4Num);
    }

    const halves = cleanIp.split("::");
    let groups: string[] = [];

    if (halves.length === 2) {
        const first = halves[0] ? halves[0].split(":") : [];
        const second = halves[1] ? halves[1].split(":") : [];
        const missing = 8 - (first.length + second.length);
        const zeros = Array(missing).fill("0");
        groups = [...first, ...zeros, ...second];
    } else {
        groups = cleanIp.split(":");
    }

    let result = BigInt(0);
    for (let i = 0; i < 8; i++) {
        const val = parseInt(groups[i] || "0", 16);
        result = (result << BigInt(16)) | BigInt(val);
    }
    return result;
}

/**
 * Parses numeric and non-standard host formats (e.g. hex 0x7f000001, octal 0177.0.0.1, decimal 2130706433).
 */
export function normalizeNumericHost(hostname: string): string | null {
    const trimmed = hostname.trim().toLowerCase();

    // Check if it is a single decimal or hex integer: e.g. 2130706433 or 0x7f000001
    if (/^(?:0x[0-9a-f]+|\d+)$/i.test(trimmed)) {
        const num = trimmed.startsWith("0x") ? parseInt(trimmed, 16) : parseInt(trimmed, 10);
        if (num >= 0 && num <= 0xffffffff) {
            const p1 = (num >>> 24) & 0xff;
            const p2 = (num >>> 16) & 0xff;
            const p3 = (num >>> 8) & 0xff;
            const p4 = num & 0xff;
            return `${p1}.${p2}.${p3}.${p4}`;
        }
    }

    // Check octal/hex dotted segments: e.g. 0177.0.0.1
    const parts = trimmed.split(".");
    if (parts.length >= 2 && parts.length <= 4) {
        let isNumeric = true;
        const parsedParts: number[] = [];
        for (const p of parts) {
            if (/^0x[0-9a-f]+$/i.test(p)) {
                parsedParts.push(parseInt(p, 16));
            } else if (/^0[0-7]+$/.test(p)) {
                parsedParts.push(parseInt(p, 8));
            } else if (/^\d+$/.test(p)) {
                parsedParts.push(parseInt(p, 10));
            } else {
                isNumeric = false;
                break;
            }
        }

        if (isNumeric && parsedParts.every((n) => n >= 0 && n <= 255) && parsedParts.length === 4) {
            return parsedParts.join(".");
        }
    }

    return null;
}

export function isPrivateIp(ip: string): boolean {
    try {
        let cleanIp = ip.trim().toLowerCase();
        if (cleanIp.startsWith("[") && cleanIp.endsWith("]")) {
            cleanIp = cleanIp.slice(1, -1);
        }

        // IPv4-mapped IPv6 check
        if (cleanIp.startsWith("::ffff:")) {
            const mapped = cleanIp.slice(7);
            if (mapped.includes(".")) {
                return isPrivateIp(mapped);
            }
            const num = normalizeNumericHost(mapped);
            if (num) return isPrivateIp(num);
        }

        const numericNormalized = normalizeNumericHost(cleanIp);
        if (numericNormalized) {
            cleanIp = numericNormalized;
        }

        const family = net.isIP(cleanIp);
        if (family === 4) {
            const uint32 = ipv4ToUint32(cleanIp);
            for (const cidr of IPV4_BLOCKED_CIDRS) {
                if ((uint32 & cidr.mask) >>> 0 === cidr.net) {
                    return true;
                }
            }
            return false;
        }

        if (family === 6) {
            const big = ipv6ToBigInt(cleanIp);
            for (const cidr of IPV6_BLOCKED_CIDRS) {
                if ((big & cidr.mask) === cidr.net) {
                    return true;
                }
            }
            return false;
        }

        return true;
    } catch {
        return true;
    }
}

export async function validateUrlForSsrf(urlStr: string): Promise<SsrfValidationResult> {
    try {
        // ALLOW_LOCAL_SSRF is strictly development/test only, NEVER allowed in production
        const isLocalAllowed =
            process.env.NODE_ENV !== "production" && process.env.ALLOW_LOCAL_SSRF === "true";

        let parsedUrl: URL;
        try {
            parsedUrl = new URL(urlStr);
        } catch {
            return { safe: false, error: "Invalid URL format" };
        }

        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
            return { safe: false, error: "Only http and https protocols are supported" };
        }

        let hostname = parsedUrl.hostname.toLowerCase();
        if (hostname.startsWith("[") && hostname.endsWith("]")) {
            hostname = hostname.slice(1, -1);
        }

        // Direct blocked hostname checks
        if (
            hostname === "localhost" ||
            hostname === "0.0.0.0" ||
            hostname === "127.0.0.1" ||
            hostname === "::1" ||
            hostname.endsWith(".localhost") ||
            hostname.endsWith(".local") ||
            hostname.endsWith(".internal")
        ) {
            if (isLocalAllowed && (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1")) {
                return {
                    safe: true,
                    resolvedIp: hostname === "::1" ? "::1" : "127.0.0.1",
                    family: hostname === "::1" ? 6 : 4,
                };
            }
            return { safe: false, error: "Localhost and internal loopback URLs are blocked" };
        }

        // Check numeric host encodings (hex, octal, single integer)
        const numericIp = normalizeNumericHost(hostname);
        if (numericIp) {
            if (isPrivateIp(numericIp)) {
                return { safe: false, error: "Private or loopback IPs are blocked" };
            }
            return {
                safe: true,
                resolvedIp: numericIp,
                family: 4,
            };
        }

        // Direct IP check if hostname is already a valid IP
        const directFamily = net.isIP(hostname);
        if (directFamily !== 0) {
            if (isPrivateIp(hostname)) {
                return { safe: false, error: "Private or loopback IPs are blocked" };
            }
            return {
                safe: true,
                resolvedIp: hostname,
                family: directFamily as 4 | 6,
            };
        }

        // Resolve DNS to verify all returned addresses against blocked CIDRs (DNS rebinding / multi-A record defense)
        try {
            const lookupResult = await dnsLookup(hostname, { all: true, verbatim: true });
            if (!lookupResult || lookupResult.length === 0) {
                return { safe: false, error: "Unable to resolve hostname" };
            }

            for (const addr of lookupResult) {
                if (isPrivateIp(addr.address)) {
                    return { safe: false, error: "Private or loopback IPs are blocked" };
                }
            }

            const approved = lookupResult[0];
            return {
                safe: true,
                resolvedIp: approved.address,
                family: approved.family === 6 ? 6 : 4,
            };
        } catch {
            return { safe: false, error: "Unable to resolve hostname" };
        }
    } catch {
        return { safe: false, error: "Invalid URL format" };
    }
}

/**
 * Fetches a URL with SSRF protection, pinning to the resolved IP to prevent DNS rebinding,
 * and re-validating redirects up to maxRedirects.
 */
export async function fetchWithValidatedSsrfUrl(
    url: string,
    validation: SsrfValidationResult,
    init: RequestInit = {},
    maxRedirects = 5
): Promise<Response> {
    if (!validation.safe) {
        throw new Error(validation.error || "Forbidden URL");
    }

    let currentUrl = url;
    let currentValidation = validation;
    let redirectCount = 0;

    while (redirectCount <= maxRedirects) {
        let dispatcher: Agent | undefined;
        if (currentValidation.resolvedIp && currentValidation.family) {
            const pinnedIp = currentValidation.resolvedIp;
            const pinnedFamily = currentValidation.family;
            const customLookup: net.LookupFunction = (_hostname, options, callback) => {
                if (options && options.all) {
                    callback(null, [{ address: pinnedIp, family: pinnedFamily }]);
                } else {
                    callback(null, pinnedIp, pinnedFamily);
                }
            };
            dispatcher = new Agent({
                connect: {
                    lookup: customLookup,
                },
            });
        }

        const mergedInit: RequestInitWithDispatcher = {
            ...init,
            redirect: "manual",
            ...(dispatcher ? { dispatcher } : {}),
        };

        const res = await fetch(currentUrl, mergedInit);

        if ([301, 302, 303, 307, 308].includes(res.status)) {
            redirectCount++;
            if (redirectCount > maxRedirects) {
                throw new Error("Too many redirects");
            }

            const location = res.headers.get("location");
            if (!location) {
                return res;
            }

            const nextUrl = new URL(location, currentUrl).toString();
            const nextValidation = await validateUrlForSsrf(nextUrl);
            if (!nextValidation.safe) {
                throw new Error(`SSRF blocked redirect to: ${nextUrl} (${nextValidation.error})`);
            }

            currentUrl = nextUrl;
            currentValidation = nextValidation;
            continue;
        }

        return res;
    }

    throw new Error("Too many redirects");
}
