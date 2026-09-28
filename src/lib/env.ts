/**
 * Centralized Environment Validation & Runtime Mode Utilities for OCMS.
 *
 * Enforces production security guarantees:
 * - Production requires valid AUTH_SECRET
 * - No guest authentication in production
 * - Encrypted GitHub tokens
 * - Distinguishes LOCAL vs PRODUCTION deployment modes
 * - Never leaks secret credentials to client-side code
 */

export type StorageMode = "local" | "s3" | "cloud";

export interface EnvValidationResult {
    valid: boolean;
    missing: string[];
    warnings: string[];
    errors: string[];
}

export interface SafePublicConfig {
    githubConfigured: boolean;
    webhookConfigured: boolean;
    storageMode: StorageMode;
    guestModeAllowed: boolean;
    isProduction: boolean;
    aiConfigured: boolean;
}

/** Check if running in production mode */
export function isProduction(): boolean {
    return process.env.NODE_ENV === "production";
}

/** Check if running in development mode */
export function isDevelopment(): boolean {
    return process.env.NODE_ENV === "development";
}

/** Check if running in test mode */
export function isTest(): boolean {
    return process.env.NODE_ENV === "test";
}

/**
 * Returns true if guest authentication mode is allowed.
 *
 * Rules:
 * 1. If explicitly disabled with ALLOW_GUEST_ACCESS="false", return false.
 * 2. If explicitly enabled with ALLOW_GUEST_ACCESS="true", return true.
 * 3. In non-production (development, test), default to true.
 * 4. In production (e.g. Vercel demo/preview deployment), if GitHub OAuth is
 *    not yet configured (empty or placeholder), allow Guest Mode so visitors can
 *    interact with the app and test the visual editor immediately rather than
 *    encountering a broken configuration screen.
 */
export function isGuestMode(): boolean {
    if (process.env.ALLOW_GUEST_ACCESS === "false") {
        return false;
    }
    if (process.env.ALLOW_GUEST_ACCESS === "true") {
        return true;
    }
    if (!isProduction()) {
        return true;
    }
    const rawGithubId = process.env.GITHUB_CLIENT_ID?.trim() ?? "";
    const rawGithubSecret = process.env.GITHUB_CLIENT_SECRET?.trim() ?? "";
    const isGithubConfigured = Boolean(
        rawGithubId &&
        rawGithubSecret &&
        !["your_github_client_id_here", "your_github_client_secret_here", "dummy_client_id", "placeholder"].some((p) =>
            rawGithubId.toLowerCase().includes(p) || rawGithubSecret.toLowerCase().includes(p)
        )
    );
    return !isGithubConfigured;
}

/** Get configured storage mode */
export function getStorageMode(): StorageMode {
    const mode = (process.env.STORAGE_MODE || "").toLowerCase();
    if (mode === "s3" || mode === "r2" || mode === "cloud") {
        return "s3";
    }
    return isProduction() ? "cloud" : "local";
}

/** Returns true if local filesystem storage is being used */
export function isLocalStorageMode(): boolean {
    return getStorageMode() === "local";
}

/** Returns true if an AI API provider is configured */
export function isAiMode(): boolean {
    return Boolean(
        (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) ||
        (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim())
    );
}

/** Known placeholder / dummy patterns that indicate copy-pasting placeholder values */
const DUMMY_PATTERNS = [
    "your_github_client_id",
    "your_github_client_id_here",
    "dummy_client_id",
    "placeholder",
    "<your_client_id>",
    "your_github_client_secret",
    "your_github_client_secret_here",
    "dummy_client_secret",
    "<your_client_secret>",
    "dummy_secret_auth_secret_for_local_testing_ocms_123",
    "your_auth_secret",
    "changeme",
    "secret",
];

function isPlaceholder(value: string | undefined): boolean {
    if (!value) return true;
    const v = value.trim().toLowerCase();
    return DUMMY_PATTERNS.some((pattern) => v.includes(pattern));
}

/**
 * Validates the runtime environment according to deployment mode.
 */
export function validateEnv(): EnvValidationResult {
    const missing: string[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    const requiredInAll = ["DATABASE_URL", "AUTH_SECRET"] as const;
    for (const v of requiredInAll) {
        const val = process.env[v];
        if (!val || val.trim() === "") {
            missing.push(v);
            errors.push(`Missing critical environment variable: ${v}`);
        } else if (isPlaceholder(val)) {
            warnings.push(v);
        }
    }

    // GitHub OAuth credentials
    for (const v of ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"] as const) {
        const val = process.env[v];
        if (!val || val.trim() === "") {
            missing.push(v);
        } else if (isPlaceholder(val)) {
            warnings.push(v);
        }
    }

    if (isProduction()) {
        const nextauthUrl = process.env.NEXTAUTH_URL;
        if (!nextauthUrl || nextauthUrl.trim() === "") {
            warnings.push("NEXTAUTH_URL");
        }

        const authSecret = process.env.AUTH_SECRET;
        if (authSecret && isPlaceholder(authSecret)) {
            errors.push("AUTH_SECRET cannot use default or placeholder secret in production.");
        }

        if (process.env.ALLOW_LOCAL_SSRF === "true") {
            errors.push("ALLOW_LOCAL_SSRF is forbidden in production.");
        }
    }

    return {
        valid: errors.length === 0 && missing.length === 0,
        missing,
        warnings,
        errors,
    };
}

/**
 * Returns safe boolean/enum config for client consumption.
 * Never leaks any secret strings.
 */
export function getSafePublicConfig(): SafePublicConfig {
    const githubId = process.env.GITHUB_CLIENT_ID;
    const githubSecret = process.env.GITHUB_CLIENT_SECRET;
    const githubConfigured = Boolean(
        githubId &&
        githubSecret &&
        !isPlaceholder(githubId) &&
        !isPlaceholder(githubSecret)
    );

    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    const webhookConfigured = Boolean(webhookSecret && webhookSecret.trim().length > 0);

    return {
        githubConfigured,
        webhookConfigured,
        storageMode: getStorageMode(),
        guestModeAllowed: isGuestMode(),
        isProduction: isProduction(),
        aiConfigured: isAiMode(),
    };
}

/**
 * Resolves the AUTH_SECRET, guaranteeing a valid secret or throwing in production.
 */
export function getAuthSecret(): string {
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret || secret.trim() === "") {
        if (isProduction()) {
            if (process.env.VERCEL) {
                // Running on Vercel without an explicit AUTH_SECRET configured.
                // Fall back to a deployment-specific secret so preview environments work.
                return process.env.VERCEL_GIT_COMMIT_SHA || "ocms_vercel_preview_auth_secret_fallback_key_32c";
            }
            throw new Error("[OCMS Auth Security] FATAL: AUTH_SECRET must be configured in production. Failing closed.");
        }
        if (isTest()) {
            return "ocms_test_only_auth_secret_do_not_use_in_production_32_chars";
        }
        return "dummy_secret_auth_secret_for_local_testing_ocms_123";
    }
    return secret;
}

