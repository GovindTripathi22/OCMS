import NextAuth, { type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma, ensureDatabaseTables } from "@/lib/prisma";

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
import { getAuthSecret, isGuestMode } from "@/lib/env";

function cleanEnv(val: string | undefined): string {
    if (!val) return "";
    let s = val.trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        s = s.slice(1, -1).trim();
    }
    return s;
}

// Canonical Prisma Adapter: database failures must remain real failures
const baseAdapter = PrismaAdapter(prisma);
const secureAdapter = {
    ...baseAdapter,
    createUser: async (user: Parameters<NonNullable<typeof baseAdapter.createUser>>[0]) => {
        await ensureDatabaseTables();
        if (!baseAdapter.createUser) return undefined;
        return baseAdapter.createUser(user);
    },
    linkAccount: async (account: Parameters<NonNullable<typeof baseAdapter.linkAccount>>[0]) => {
        await ensureDatabaseTables();
        const encryptedAccount = {
            ...account,
            access_token: account.access_token ? encryptToken(account.access_token) : account.access_token,
            refresh_token: account.refresh_token ? encryptToken(account.refresh_token) : account.refresh_token,
        };
        if (!baseAdapter.linkAccount) return undefined;
        return baseAdapter.linkAccount(encryptedAccount);
    },
    getAccount: async (providerAccountId: string, provider: string) => {
        await ensureDatabaseTables();
        if (!baseAdapter.getAccount) return null;
        const account = await baseAdapter.getAccount(providerAccountId, provider);
        if (!account) return null;
        return {
            ...account,
            access_token: account.access_token ? decryptToken(account.access_token) : account.access_token,
            refresh_token: account.refresh_token ? decryptToken(account.refresh_token) : account.refresh_token,
        };
    },
    getUserByAccount: async (providerAccountId: Parameters<NonNullable<typeof baseAdapter.getUserByAccount>>[0]) => {
        await ensureDatabaseTables();
        if (!baseAdapter.getUserByAccount) return null;
        return baseAdapter.getUserByAccount(providerAccountId);
    },
    getUserByEmail: async (email: string) => {
        await ensureDatabaseTables();
        if (!baseAdapter.getUserByEmail) return null;
        return baseAdapter.getUserByEmail(email);
    },
} as unknown as ReturnType<typeof PrismaAdapter>;

const rawGithubId = cleanEnv(
    process.env.GITHUB_CLIENT_ID ||
    process.env.GITHUB_ID ||
    process.env.AUTH_GITHUB_ID
);
const rawGithubSecret = cleanEnv(
    process.env.GITHUB_CLIENT_SECRET ||
    process.env.GITHUB_SECRET ||
    process.env.AUTH_GITHUB_SECRET
);
const isGithubConfigured = Boolean(
    rawGithubId &&
    rawGithubSecret &&
    !["your_github_client_id_here", "your_github_client_secret_here", "dummy_client_id", "placeholder"].some((p) =>
        rawGithubId.toLowerCase().includes(p) || rawGithubSecret.toLowerCase().includes(p)
    )
);

const allowGuest = isGuestMode();

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

// Register Credentials provider for instant guest authentication when guest mode is active
if (allowGuest) {
    activeProviders.push(
        Credentials({
            id: "guest",
            name: "Guest Mode",
            credentials: {},
            async authorize() {
                if (!isGuestMode()) {
                    return null;
                }
                await ensureDatabaseTables();
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

    const allowGuest = isGuestMode();

    if (!allowGuest) {
        return null;
    }

    console.warn(
        "[OCMS Auth] Guest fallback activated (guest mode allowed)."
    );

    try {
        await ensureDatabaseTables();
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
