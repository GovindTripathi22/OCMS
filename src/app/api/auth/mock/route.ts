import { NextResponse } from "next/server";
import { getAuthorizedUser } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
    try {
        const isProduction = process.env.NODE_ENV === "production";
        const allowGuest = process.env.ALLOW_GUEST_ACCESS === "true";
        if (isProduction && !allowGuest) {
            return NextResponse.json({ error: "Unauthorized - mock auth disabled in production" }, { status: 401 });
        }

        const userId = await getAuthorizedUser();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Upsert Account record with mock token
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

        return NextResponse.json({ success: true, message: "Mock account registered successfully." });
    } catch (error) {
        console.error("Mock auth error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
