import NextAuth, { type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
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
import { encryptToken, decryptToken } from "@/lib/crypto";
import { getAuthSecret } from "@/lib/env";

// Canonical Prisma Adapter: database failures must remain real failures
const baseAdapter = PrismaAdapter(prisma);
const secureAdapter = {
    ...baseAdapter,
    linkAccount: async (account: Parameters<NonNullable<typeof baseAdapter.linkAccount>>[0]) => {
        const encryptedAccount = {
            ...account,
            access_token: account.access_token ? encryptToken(account.access_token) : account.access_token,
            refresh_token: account.refresh_token ? encryptToken(account.refresh_token) : account.refresh_token,
        };
        if (!baseAdapter.linkAccount) return undefined;
        return baseAdapter.linkAccount(encryptedAccount);
    },
    getAccount: async (providerAccountId: string, provider: string) => {
        if (!baseAdapter.getAccount) return null;
        const account = await baseAdapter.getAccount(providerAccountId, provider);
        if (!account) return null;
        return {
            ...account,
            access_token: account.access_token ? decryptToken(account.access_token) : account.access_token,
            refresh_token: account.refresh_token ? decryptToken(account.refresh_token) : account.refresh_token,
        };
    },
} as unknown as ReturnType<typeof PrismaAdapter>;

const rawGithubId = process.env.GITHUB_CLIENT_ID?.trim() ?? "";
const rawGithubSecret = process.env.GITHUB_CLIENT_SECRET?.trim() ?? "";
const isGithubConfigured = Boolean(
    rawGithubId &&
    rawGithubSecret &&
    !["your_github_client_id_here", "your_github_client_secret_here", "dummy_client_id", "placeholder"].some((p) =>
        rawGithubId.toLowerCase().includes(p) || rawGithubSecret.toLowerCase().includes(p)
    )
);

const isProd = process.env.NODE_ENV === "production";
const allowGuest = process.env.ALLOW_GUEST_ACCESS === "true";

// Build list of active authentication providers
const activeProviders = [];

if (isGithubConfigured) {
    activeProviders.push(
        GitHub({
            clientId: rawGithubId,
            clientSecret: rawGithubSecret,
            authorization: {
                params: {
                    scope: "read:user user:email repo",
                },
            },
        })
    );
}

// In local development or test mode, register Credentials provider for instant guest authentication
if (!isProd && allowGuest) {
    activeProviders.push(
        Credentials({
            id: "guest",
            name: "Guest Mode",
            credentials: {},
            async authorize() {
                if (process.env.NODE_ENV === "production" || process.env.ALLOW_GUEST_ACCESS !== "true") {
                    return null;
                }
                let guestUser = await prisma.user.findFirst({
                    where: {
                        OR: [
                            { email: "guest@ocms.dev" },
                            { email: "guest@ocms.ai" },
                        ],
                    },
                });
                if (!guestUser) {
                    guestUser = await prisma.user.create({
                        data: {
                            name: "Guest User",
                            email: "guest@ocms.dev",
                        },
                    });
                }
                return {
                    id: guestUser.id,
                    name: guestUser.name,
                    email: guestUser.email,
                };
            },
        })
    );
}

// Fallback provider so NextAuth always has at least one provider defined
if (activeProviders.length === 0) {
    activeProviders.push(
        GitHub({
            clientId: rawGithubId || "unconfigured",
            clientSecret: rawGithubSecret || "unconfigured",
        })
    );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: secureAdapter,
    trustHost: true,
    secret: getAuthSecret(),
    session: {
        strategy: "jwt",
    },
    pages: {
        signIn: "/auth/signin",
        error: "/auth/error",
    },
    providers: activeProviders,
    callbacks: {
        jwt: async ({ token, user, account }) => {
            if (user) {
                token.id = user.id;
            }
            if (account?.access_token) {
                token.accessToken = account.access_token;
            } else if (account?.provider === "guest") {
                token.accessToken = "mock_token";
            }
            return token;
        },
        session: async ({ session, token }) => {
            if (session.user && token) {
                session.user.id = (token.id as string) || (token.sub as string) || "user";
                // Note: OCMS is 100% free and open-source; no paid tiers or paywalls exist.
                session.user.subscription = "free";
            }
            return session;
        },
    },
});

/**
 * SECURITY NOTE - Token Handling at Rest:
 * GitHub OAuth tokens stored in the Account table should be encrypted using AES-256-GCM
 * with a key derived from AUTH_SECRET when persistent production database access is shared.
 */

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
        console.warn("[Auth] Session validation notice:", err);
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
