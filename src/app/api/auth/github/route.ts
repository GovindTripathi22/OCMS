import { NextResponse } from "next/server";

/**
 * This route previously contained a placeholder GitHub OAuth handler.
 *
 * GitHub OAuth is fully managed by NextAuth at:
 *   POST /api/auth/signin/github
 *   GET  /api/auth/callback/github
 *
 * This file is intentionally left as a 410 Gone to prevent
 * accidental usage of a stale/custom OAuth flow.
 */
export async function GET() {
    return NextResponse.json(
        {
            error: "This endpoint is deprecated. GitHub OAuth is handled by NextAuth at /api/auth/signin/github",
        },
        { status: 410 }
    );
}

export async function POST() {
    return NextResponse.json(
        {
            error: "This endpoint is deprecated. GitHub OAuth is handled by NextAuth at /api/auth/signin/github",
        },
        { status: 410 }
    );
}
