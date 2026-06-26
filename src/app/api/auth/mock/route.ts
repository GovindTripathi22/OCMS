import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
    try {
        const session = await auth();
        let userId = session?.user?.id;

        if (!userId) {
            let guestUser = await prisma.user.findFirst({
                where: { email: "guest@ocms.ai" }
            });
            if (!guestUser) {
                guestUser = await prisma.user.create({
                    data: {
                        name: "Guest User",
                        email: "guest@ocms.ai",
                    }
                });
            }
            userId = guestUser.id;
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
