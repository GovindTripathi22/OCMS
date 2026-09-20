import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/validation";

/**
 * Validates request Origin / Referer for state-changing mutation routes.
 * Prevents CSRF and unauthorized cross-origin mutations.
 */
export function validateMutationOrigin(req: Request): NextResponse | null {
    const method = req.method.toUpperCase();
    if (method !== "POST" && method !== "PUT" && method !== "PATCH" && method !== "DELETE") {
        return null;
    }

    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    const host = req.headers.get("host");

    const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL;
    const allowedHosts = new Set<string>();

    if (host) {
        allowedHosts.add(host.toLowerCase());
    }

    if (appUrl) {
        try {
            const parsed = new URL(appUrl);
            allowedHosts.add(parsed.host.toLowerCase());
        } catch {}
    }

    // In development and test environments, allow local dev servers
    if (process.env.NODE_ENV !== "production") {
        allowedHosts.add("localhost:3000");
        allowedHosts.add("127.0.0.1:3000");
        allowedHosts.add("localhost");
        allowedHosts.add("127.0.0.1");
    }

    if (origin) {
        try {
            const parsedOrigin = new URL(origin);
            if (!allowedHosts.has(parsedOrigin.host.toLowerCase())) {
                return createErrorResponse(
                    "CSRF_REJECTED",
                    `Cross-origin mutation rejected from origin ${origin}`,
                    403
                );
            }
        } catch {
            return createErrorResponse("CSRF_REJECTED", "Invalid request origin header", 403);
        }
    } else if (referer) {
        try {
            const parsedReferer = new URL(referer);
            if (!allowedHosts.has(parsedReferer.host.toLowerCase())) {
                return createErrorResponse(
                    "CSRF_REJECTED",
                    `Cross-origin mutation rejected from referer ${referer}`,
                    403
                );
            }
        } catch {
            return createErrorResponse("CSRF_REJECTED", "Invalid request referer header", 403);
        }
    }

    return null;
}
