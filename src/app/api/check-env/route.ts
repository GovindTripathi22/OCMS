import { NextResponse } from "next/server";

/**
 * GET /api/check-env
 *
 * Checks whether critical environment variables are configured.
 * Returns { configured, missing, warnings } — never exposes actual values.
 *
 * Variable naming: this app uses AUTH_SECRET (not NEXTAUTH_SECRET).
 * Both NextAuth v4 and Auth.js v5 support AUTH_SECRET natively.
 */
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

    const requiredVars = [
        "GITHUB_CLIENT_ID",
        "GITHUB_CLIENT_SECRET",
        "DATABASE_URL",
        "AUTH_SECRET",
    ] as const;

    for (const varName of requiredVars) {
        const value = process.env[varName];

        if (!value || value.trim() === "") {
            missing.push(varName);
            continue;
        }

        const v = value.trim().toLowerCase();

        if (varName === "GITHUB_CLIENT_ID" && PLACEHOLDER_PATTERNS.some(p => v.includes(p))) {
            warnings.push(varName);
        }

        if (varName === "GITHUB_CLIENT_SECRET" && SECRET_PLACEHOLDER_PATTERNS.some(p => v.includes(p))) {
            warnings.push(varName);
        }

        if (varName === "AUTH_SECRET" && AUTH_SECRET_PLACEHOLDERS.some(p => v === p)) {
            warnings.push(varName);
        }
    }

    // Optional: warn if NEXTAUTH_URL is missing (needed in production)
    const nextauthUrl = process.env.NEXTAUTH_URL;
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction && (!nextauthUrl || nextauthUrl.trim() === "")) {
        warnings.push("NEXTAUTH_URL");
    }

    const configured = missing.length === 0 && warnings.length === 0;

    return NextResponse.json({ configured, missing, warnings });
}
