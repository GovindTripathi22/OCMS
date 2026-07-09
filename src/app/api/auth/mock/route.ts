import { NextResponse } from "next/server";
import { getAuthorizedUser } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/mock
 *
 * Development-only route that creates a mock GitHub account record
 * with a "mock_token" so the publish flow works against the local filesystem.
 *
 * HARD BLOCK: This route returns 403 in production regardless of any
 * environment flags. It must never be reachable in a live deployment.
 */
export async function POST() {
    // Hard production block — this check cannot be bypassed by env flags
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
            { error: "This endpoint is not available in production." },
            { status: 403 }
        );
    }

    // Secondary guard: also require explicit opt-in in dev
    if (process.env.ALLOW_GUEST_ACCESS !== "true") {
        return NextResponse.json(
            {
                error: "Mock auth is disabled. Set ALLOW_GUEST_ACCESS=true in your .env.local to enable guest mode.",
            },
            { status: 403 }
        );
    }

    try {
        const userId = await getAuthorizedUser();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Upsert Account record with mock token (local dev only)
        const existingAccount = await prisma.account.findFirst({
            where: {
                userId: userId,
                provider: "github"
            }
        });

        if (existingAccount) {
            await prisma.account.update({
                where: { id: existingAccount.id },
                data: {
                    access_token: "mock_token",
                    providerAccountId: "mock_github_user",
                }
            });
        } else {
            await prisma.account.create({
                data: {
                    userId: userId,
                    type: "oauth",
                    provider: "github",
                    providerAccountId: "mock_github_user",
                    access_token: "mock_token"
                }
            });
        }

        return NextResponse.json({
            success: true,
            message: "[DEV MODE] Mock account registered. Changes will sync to local filesystem.",
            warning: "This only works in development. Set up real GitHub OAuth for production use.",
        });
    } catch (error) {
        console.error("Mock auth error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
