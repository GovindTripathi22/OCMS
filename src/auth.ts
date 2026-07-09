import NextAuth, { type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            subscription: string;
        } & DefaultSession["user"];
    }
    interface User {
        subscription?: string;
    }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    providers: [
        GitHub({
            clientId: process.env.GITHUB_CLIENT_ID ?? "",
            clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
            // Request `repo` scope for full read/write access to user repositories
            authorization: {
                params: {
                    scope: "read:user user:email repo",
                },
            },
        }),
    ],
    callbacks: {
        session: async ({ session, user }) => {
            if (session.user) {
                session.user.id = user.id;
                session.user.subscription = user.subscription || "free";
            }
            return session;
        },
    },
});

/**
 * Returns the authenticated user ID.
 *
 * Guest fallback is ONLY allowed when ALL of the following are true:
 *   1. NODE_ENV is "development" (never in production)
 *   2. ALLOW_GUEST_ACCESS === "true" (explicit opt-in)
 *
 * This prevents accidental guest access in production deployments.
 */
export async function getAuthorizedUser(): Promise<string | null> {
    const session = await auth();
    let userId = session?.user?.id;

    if (!userId) {
        const isProduction = process.env.NODE_ENV === "production";
        const allowGuest = process.env.ALLOW_GUEST_ACCESS === "true";

        // Hard block: guest access is never allowed in production
        if (isProduction) {
            return null;
        }

        // Require explicit opt-in even in development
        if (!allowGuest) {
            return null;
        }

        console.warn(
            "[OCMS] Guest fallback activated. " +
            "Set ALLOW_GUEST_ACCESS=false to disable. " +
            "This will NOT work in production."
        );

        // Fallback to Guest user (development + explicit ALLOW_GUEST_ACCESS=true only)
        let guestUser = await prisma.user.findFirst({
            where: { email: "guest@ocms.dev" }
        });
        if (!guestUser) {
            guestUser = await prisma.user.create({
                data: {
                    name: "Guest User",
                    email: "guest@ocms.dev",
                }
            });
        }
        userId = guestUser.id;
    }
    return userId;
}
