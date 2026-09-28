import { NextResponse } from "next/server";
import { isGuestMode, isProduction } from "@/lib/env";

/**
 * GET /api/check-env
 *
 * Checks whether critical environment variables are configured.
 * Returns { configured, missing, warnings } — never exposes actual values.
 *
 * Variable naming: this app uses AUTH_SECRET (not NEXTAUTH_SECRET).
 * Both NextAuth v4 and Auth.js v5 support AUTH_SECRET natively.
 */
function cleanEnv(val: string | undefined): string {
    if (!val) return "";
    let s = val.trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        s = s.slice(1, -1).trim();
    }
    return s;
}

export async function GET() {
    const missing: string[] = [];
    const warnings: string[] = [];

    // Known placeholder / dummy values that indicate copy-paste without real config
    const PLACEHOLDER_PATTERNS = [
        "your_github_client_id",
        "your_github_client_id_here",
        "dummy_client_id",
        "placeholder",
        "<your_client_id>",
    ];
    const SECRET_PLACEHOLDER_PATTERNS = [
        "your_github_client_secret",
        "your_github_client_secret_here",
        "dummy_client_secret",
        "placeholder",
        "<your_client_secret>",
    ];

    // AUTH_SECRET placeholder values (the .env ships with one for local dev)
    const AUTH_SECRET_PLACEHOLDERS = [
        "dummy_secret_auth_secret_for_local_testing_ocms_123",
        "your_auth_secret",
        "changeme",
        "secret",
    ];

    const githubId = cleanEnv(
        process.env.GITHUB_CLIENT_ID ||
        process.env.GITHUB_ID ||
        process.env.AUTH_GITHUB_ID
    );
    const githubSecret = cleanEnv(
        process.env.GITHUB_CLIENT_SECRET ||
        process.env.GITHUB_SECRET ||
        process.env.AUTH_GITHUB_SECRET
    );
    const authSecret = cleanEnv(
        process.env.AUTH_SECRET ||
        process.env.NEXTAUTH_SECRET
    );

    if (!githubId) {
        missing.push("GITHUB_CLIENT_ID");
    } else if (PLACEHOLDER_PATTERNS.some(p => githubId.toLowerCase().includes(p))) {
        warnings.push("GITHUB_CLIENT_ID");
    }

    if (!githubSecret) {
        missing.push("GITHUB_CLIENT_SECRET");
    } else if (SECRET_PLACEHOLDER_PATTERNS.some(p => githubSecret.toLowerCase().includes(p))) {
        warnings.push("GITHUB_CLIENT_SECRET");
    }

    if (!authSecret) {
        missing.push("AUTH_SECRET");
    } else if (AUTH_SECRET_PLACEHOLDERS.some(p => authSecret.toLowerCase() === p)) {
        warnings.push("AUTH_SECRET");
    }

    // Optional: warn if NEXTAUTH_URL is missing (needed in production)
    const nextauthUrl = cleanEnv(process.env.NEXTAUTH_URL || process.env.AUTH_URL);
    const isProd = isProduction();
    if (isProd && !nextauthUrl) {
        warnings.push("NEXTAUTH_URL");
    }
    const guestModeAllowed = isGuestMode();
    const githubConfigured = !missing.includes("GITHUB_CLIENT_ID") && !warnings.includes("GITHUB_CLIENT_ID");

    const configured = missing.length === 0 && warnings.length === 0;

    return NextResponse.json({
        configured,
        missing,
        warnings,
        isGuestMode: guestModeAllowed,
        isProduction: isProd,
        githubConfigured,
    });
}
