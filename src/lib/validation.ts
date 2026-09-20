import path from "path";
import { NextResponse } from "next/server";

export interface StandardErrorResponse {
    success: false;
    errorCode: string;
    message: string;
    fieldErrors?: Record<string, string>;
}

export function createErrorResponse(
    errorCode: string,
    message: string,
    status: number = 400,
    fieldErrors?: Record<string, string>
): NextResponse {
    const body: StandardErrorResponse = {
        success: false,
        errorCode,
        message,
        ...(fieldErrors ? { fieldErrors } : {}),
    };
    return NextResponse.json(body, { status });
}

export const SAFE_IDENTIFIER_REGEX = /^[a-zA-Z0-9_.\-]+$/;
export const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export const LIMITS = {
    PROJECT_NAME_MAX_LENGTH: 100,
    URL_MAX_LENGTH: 2048,
    SCHEMA_MAX_FIELDS: 500,
    SCHEMA_MAX_BYTES: 500 * 1024, // 500KB
    FIELD_ID_MAX_LENGTH: 100,
    LABEL_MAX_LENGTH: 100,
    TEXT_VALUE_MAX_LENGTH: 50000,
    SELECTOR_MAX_LENGTH: 500,
    CHANGES_MAX_COUNT: 100,
    CHANGES_PAYLOAD_MAX_BYTES: 1024 * 1024, // 1MB
    GSD_MESSAGE_MAX_LENGTH: 5000,
    HTML_PAYLOAD_MAX_BYTES: 5 * 1024 * 1024, // 5MB
    COMPONENT_PAYLOAD_MAX_BYTES: 500 * 1024, // 500KB
    MODEL_NAME_MAX_LENGTH: 100,
    VARIANT_NAME_MAX_LENGTH: 100,
    CSS_PATH_MAX_LENGTH: 255,
    REPO_STRING_MAX_LENGTH: 100,
};

export function validateProjectName(name: unknown): { valid: boolean; error?: string } {
    if (typeof name !== "string" || name.trim().length === 0) {
        return { valid: false, error: "Project name is required" };
    }
    if (name.trim().length > LIMITS.PROJECT_NAME_MAX_LENGTH) {
        return { valid: false, error: `Project name cannot exceed ${LIMITS.PROJECT_NAME_MAX_LENGTH} characters` };
    }
    return { valid: true };
}

export function validateHttpUrl(urlStr: unknown): { valid: boolean; error?: string } {
    if (typeof urlStr !== "string" || urlStr.trim().length === 0) {
        return { valid: false, error: "URL is required" };
    }
    if (urlStr.length > LIMITS.URL_MAX_LENGTH) {
        return { valid: false, error: `URL cannot exceed ${LIMITS.URL_MAX_LENGTH} characters` };
    }
    try {
        const parsed = new URL(urlStr);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return { valid: false, error: "Only http and https protocols are supported" };
        }
        return { valid: true };
    } catch {
        return { valid: false, error: "Invalid URL format" };
    }
}

export function validateRepoString(str: unknown, fieldName: string): { valid: boolean; error?: string } {
    if (typeof str !== "string" || str.trim().length === 0) {
        return { valid: false, error: `${fieldName} is required` };
    }
    if (str.length > LIMITS.REPO_STRING_MAX_LENGTH) {
        return { valid: false, error: `${fieldName} exceeds maximum length` };
    }
    if (!SAFE_IDENTIFIER_REGEX.test(str)) {
        return { valid: false, error: `${fieldName} contains invalid characters` };
    }
    return { valid: true };
}

export function validateHexColor(color: unknown): boolean {
    return typeof color === "string" && HEX_COLOR_REGEX.test(color.trim());
}

/**
 * Ensures that a target path resolves strictly inside the root directory.
 * Defends against `../`, `..\\`, encoded characters, absolute paths, Windows drive escapes.
 */
export function safePathInsideRoot(rootPath: string, relativePath: string): string | null {
    if (!relativePath || typeof relativePath !== "string") return null;

    // Reject null bytes
    if (relativePath.includes("\0")) return null;

    // Quick checks for obvious traversals
    const decoded = decodeURIComponent(relativePath);
    if (decoded.includes("..") || relativePath.includes("..")) {
        // Additional strict checks
    }

    const resolvedRoot = path.resolve(rootPath);
    const resolvedTarget = path.resolve(resolvedRoot, relativePath);

    // Normalize slashes for comparison
    const normRoot = path.normalize(resolvedRoot).toLowerCase();
    const normTarget = path.normalize(resolvedTarget).toLowerCase();

    // Must be exactly the root or inside the root directory
    if (normTarget === normRoot) {
        return resolvedTarget;
    }

    const prefix = normRoot.endsWith(path.sep) ? normRoot : normRoot + path.sep;
    if (normTarget.startsWith(prefix)) {
        return resolvedTarget;
    }

    return null;
}

export async function parseJsonSafely<T = unknown>(
    req: Request,
    maxBytes?: number
): Promise<{ data: T | null; error: NextResponse | null }> {
    try {
        const text = await req.text();
        if (maxBytes && text.length > maxBytes) {
            return {
                data: null,
                error: createErrorResponse(
                    "PAYLOAD_TOO_LARGE",
                    `Request body exceeds maximum size of ${maxBytes} bytes`,
                    413
                ),
            };
        }
        if (!text || text.trim() === "") {
            return {
                data: null,
                error: createErrorResponse("EMPTY_BODY", "Request body cannot be empty", 400),
            };
        }
        const data = JSON.parse(text) as T;
        return { data, error: null };
    } catch {
        return {
            data: null,
            error: createErrorResponse("INVALID_JSON", "Malformed JSON body", 400),
        };
    }
}
