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

function resolveAuthSecret(): string {
    const secret = process.env.AUTH_SECRET;
    if (!secret || secret.trim() === "") {
        if (process.env.NODE_ENV === "production") {
            throw new Error(
                "[OCMS Auth Security] FATAL: AUTH_SECRET must be configured in production. Failing closed."
            );
        }
        if (process.env.NODE_ENV === "test") {
            return "ocms_test_only_auth_secret_do_not_use_in_production_32_chars";
        }
        throw new Error(
            "[OCMS Auth Security] AUTH_SECRET is not configured in your environment. Please set AUTH_SECRET in .env.local."
        );
    }
    return secret;
}

// Canonical Prisma Adapter: database failures must remain real failures
const adapter = PrismaAdapter(prisma);

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter,
    trustHost: true,
    secret: resolveAuthSecret(),
    session: {
        strategy: "jwt",
    },
    providers: [
        GitHub({
            clientId: process.env.GITHUB_CLIENT_ID ?? "",
            clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
            authorization: {
                params: {
                    scope: "read:user user:email repo",
                },
            },
        }),
    ],
    callbacks: {
        jwt: async ({ token, user, account }) => {
            if (user) {
                token.id = user.id;
            }
            if (account?.access_token) {
                token.accessToken = account.access_token;
            }
            return token;
        },
        session: async ({ session, token }) => {
            if (session.user && token) {
                session.user.id = (token.id as string) || (token.sub as string) || "user";
                session.user.subscription = "free";
            }
            return session;
        },
    },
});

/**
 * Returns the authenticated user ID.
 *
 * Guest fallback is ONLY allowed when ALL of the following are true:
 *   1. NODE_ENV is NOT "production"
 *   2. ALLOW_GUEST_ACCESS === "true" (explicit opt-in)
 *
 * This guarantees that guest access can NEVER bypass authentication in production.
 */
export async function getAuthorizedUser(): Promise<string | null> {
    try {
        const session = await auth();
        if (session?.user?.id) {
            return session.user.id;
        }
    } catch (err) {
        console.error("[Auth] Session validation error:", err);
        return null;
    }

    const isProduction = process.env.NODE_ENV === "production";
    const allowGuest = process.env.ALLOW_GUEST_ACCESS === "true";

    // Hard block: guest access is never allowed in production
    if (isProduction || !allowGuest) {
        return null;
    }

    console.warn(
        "[OCMS Auth] Guest fallback activated (development/test mode with ALLOW_GUEST_ACCESS=true)."
    );

    try {
        let guestUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: "guest@ocms.dev" },
                    { email: "guest@ocms.ai" }
                ]
            }
        });
        if (!guestUser) {
            guestUser = await prisma.user.create({
                data: {
                    name: "Guest User",
                    email: "guest@ocms.dev",
                }
            });
        }
        return guestUser.id;
    } catch (dbErr) {
        console.error("[Auth] Failed to resolve guest user in database:", dbErr);
        return null;
    }
}
