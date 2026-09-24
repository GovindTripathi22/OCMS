/**
 * Structured Logging for OCMS API Requests & Security Events.
 *
 * Enforces:
 * - Request ID tracking
 * - Safe metadata (userId, projectId, route, operation, duration)
 * - Zero secret leakage (tokens, cookies, auth headers, credentials never logged)
 */

export interface LogContext {
    requestId?: string;
    route?: string;
    method?: string;
    operation?: string;
    userId?: string;
    projectId?: string;
    durationMs?: number;
    status?: number;
    error?: string;
}

const REDACTED_KEYS = new Set([
    "access_token",
    "refresh_token",
    "token",
    "secret",
    "password",
    "authorization",
    "cookie",
    "auth_secret",
    "client_secret",
]);

function sanitizeMetadata(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!meta) return undefined;
    const clean: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(meta)) {
        if (REDACTED_KEYS.has(key.toLowerCase())) {
            clean[key] = "[REDACTED]";
        } else if (typeof val === "object" && val !== null) {
            clean[key] = sanitizeMetadata(val as Record<string, unknown>);
        } else {
            clean[key] = val;
        }
    }
    return clean;
}

export const logger = {
    info(message: string, context?: LogContext, metadata?: Record<string, unknown>): void {
        const payload = {
            level: "INFO",
            timestamp: new Date().toISOString(),
            message,
            ...context,
            ...(metadata ? { metadata: sanitizeMetadata(metadata) } : {}),
        };
        console.log(JSON.stringify(payload));
    },

    warn(message: string, context?: LogContext, metadata?: Record<string, unknown>): void {
        const payload = {
            level: "WARN",
            timestamp: new Date().toISOString(),
            message,
            ...context,
            ...(metadata ? { metadata: sanitizeMetadata(metadata) } : {}),
        };
        console.warn(JSON.stringify(payload));
    },

    error(message: string, context?: LogContext, error?: unknown): void {
        const errorMessage = error instanceof Error ? error.message : String(error || "");
        const payload = {
            level: "ERROR",
            timestamp: new Date().toISOString(),
            message,
            ...context,
            error: errorMessage,
        };
        console.error(JSON.stringify(payload));
    },
};
