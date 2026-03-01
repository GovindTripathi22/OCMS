import { NextResponse } from "next/server";

/**
 * POST /api/auth/github
 * Handles GitHub OAuth callback — placeholder for NextAuth integration.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { code } = body;

        if (!code) {
            return NextResponse.json(
                { error: "Missing authorization code" },
                { status: 400 }
            );
        }

        // TODO: Exchange `code` for access token using GitHub OAuth App credentials
        // const tokenResponse = await fetch("https://github.com/login/oauth/access_token", { ... })

        return NextResponse.json({
            message: "GitHub OAuth placeholder — exchange code for token here",
            code,
        });
    } catch {
        return NextResponse.json(
            { error: "Authentication failed" },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json({
        provider: "github",
        status: "ready",
        message: "Use POST with { code } to authenticate",
    });
}
