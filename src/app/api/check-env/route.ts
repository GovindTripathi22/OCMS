import { NextResponse } from "next/server";

/**
 * GET /api/check-env
 *
 * Checks whether critical environment variables are configured.
 * Returns { configured, missing, warnings } — never exposes actual values.
 */
export async function GET() {
    const missing: string[] = [];
    const warnings: string[] = [];

    const DUMMY_GITHUB_CLIENT_IDS = [
        "your_github_client_id",
        "dummy_client_id",
    ];
    const DUMMY_GITHUB_CLIENT_SECRETS = [
        "your_github_client_secret",
        "dummy_client_secret",
    ];

    const requiredVars = [
        "GITHUB_CLIENT_ID",
        "GITHUB_CLIENT_SECRET",
        "GEMINI_API_KEY",
        "DATABASE_URL",
        "NEXTAUTH_SECRET",
    ] as const;

    for (const varName of requiredVars) {
        const value = process.env[varName];

        if (!value || value.trim() === "") {
            missing.push(varName);
            continue;
        }

        // Check for dummy / placeholder values
        if (
            varName === "GITHUB_CLIENT_ID" &&
            DUMMY_GITHUB_CLIENT_IDS.includes(value.trim().toLowerCase())
        ) {
            warnings.push(varName);
        }

        if (
            varName === "GITHUB_CLIENT_SECRET" &&
            DUMMY_GITHUB_CLIENT_SECRETS.includes(value.trim().toLowerCase())
        ) {
            warnings.push(varName);
        }
    }

    const configured = missing.length === 0 && warnings.length === 0;

    return NextResponse.json({ configured, missing, warnings });
}
