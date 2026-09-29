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
        accessToken?: string;
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

function normalizeUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    let u = cleanEnv(url);
    if (!u) return undefined;
    if (!u.startsWith("http://") && !u.startsWith("https://")) {
        u = `https://${u}`;
    }
    return u.replace(/\/+$/, "");
}

// Canonical production & Vercel deployment URL normalization
const defaultVercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "ocms-one.vercel.app";
const resolvedBaseUrl = normalizeUrl(process.env.AUTH_URL || process.env.NEXTAUTH_URL) || `https://${defaultVercelHost}`;

if (!process.env.AUTH_URL) {
    process.env.AUTH_URL = resolvedBaseUrl;
}
if (!process.env.NEXTAUTH_URL) {
    process.env.NEXTAUTH_URL = resolvedBaseUrl;
}
if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
    process.env.AUTH_SECRET = getAuthSecret();
}
process.env.AUTH_TRUST_HOST ??= "true";

// Canonical Resilient Prisma Adapter:
// On serverless platforms (e.g. Vercel), SQLite databases are ephemeral and filesystems are read-only.
// In NextAuth v5, any uncaught error in adapter methods is mapped directly to a fatal "Configuration" error.
// Since OCMS uses JWT session strategy, the session is self-contained in the encrypted JWT cookie.
// The adapter gracefully absorbs database failures, upserts duplicate accounts, and synthesizes
// fallback user objects so authentication NEVER fails due to transient database or storage issues.
const baseAdapter = PrismaAdapter(prisma);

export const resilientAdapter = {
    ...baseAdapter,
    createUser: async (user: Parameters<NonNullable<typeof baseAdapter.createUser>>[0]) => {
        try {
            await ensureDatabaseTables();
            if (baseAdapter.createUser) {
                const created = await baseAdapter.createUser(user);
                if (created) return created;
            }
        } catch (err) {
            console.warn("[AuthAdapter] baseAdapter.createUser notice:", err);
        }

        // Fallback 1: Check if user already exists by email
        if (user.email) {
            try {
                const existing = await prisma.user.findFirst({ where: { email: user.email } });
                if (existing) return existing;
            } catch (findErr) {
                console.warn("[AuthAdapter] User findFirst fallback notice:", findErr);
            }
        }

        // Fallback 2: Try direct prisma creation with explicit ID
        const fallbackId = user.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        try {
            const direct = await prisma.user.create({
                data: {
                    id: fallbackId,
                    name: user.name || "GitHub User",
                    email: user.email || null,
                    image: user.image || null,
                    emailVerified: user.emailVerified || null,
                    subscription: "FREE",
                },
            });
            if (direct) return direct;
        } catch (directErr) {
            console.warn("[AuthAdapter] Direct prisma.user.create fallback notice:", directErr);
        }

        // Fallback 3: Return synthesized user object so JWT session creation succeeds.
        // DO NOT throw. An uncaught throw causes NextAuth to redirect to /auth/error?error=Configuration.
        console.warn("[AuthAdapter] Returning resilient user fallback for JWT session:", fallbackId);
        return {
            id: fallbackId,
            name: user.name || "GitHub User",
            email: user.email || "",
            emailVerified: user.emailVerified || null,
            image: user.image || null,
        };
    },
    linkAccount: async (account: Parameters<NonNullable<typeof baseAdapter.linkAccount>>[0]) => {
        try {
            await ensureDatabaseTables();
            // Safely encrypt tokens — if encryption fails (key mismatch), store raw
            let encAccessToken = account.access_token;
            let encRefreshToken = account.refresh_token;
            try {
                encAccessToken = account.access_token ? encryptToken(account.access_token) : account.access_token;
                encRefreshToken = account.refresh_token ? encryptToken(account.refresh_token) : account.refresh_token;
            } catch (encErr) {
                console.warn("[AuthAdapter] Token encryption failed, storing raw tokens:", encErr);
            }
            const encryptedAccount = {
                ...account,
                access_token: encAccessToken,
                refresh_token: encRefreshToken,
            };
            if (baseAdapter.linkAccount) {
                return await baseAdapter.linkAccount(encryptedAccount);
            }
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.warn("[AuthAdapter] linkAccount notice, updating existing account record:", errMsg);
            // Handle duplicate account linking (P2002 or unique constraint)
            try {
                let encToken = account.access_token;
                let encRefresh = account.refresh_token;
                try {
                    encToken = account.access_token ? encryptToken(account.access_token) : account.access_token;
                    encRefresh = account.refresh_token ? encryptToken(account.refresh_token) : account.refresh_token;
                } catch (encErr2) {
                    console.warn("[AuthAdapter] Token encryption in upsert fallback failed:", encErr2);
                }
                await prisma.account.updateMany({
                    where: {
                        provider: account.provider,
                        providerAccountId: account.providerAccountId,
                    },
                    data: {
                        userId: account.userId,
                        access_token: encToken,
                        refresh_token: encRefresh,
                        expires_at: account.expires_at,
                        token_type: account.token_type,
                        scope: account.scope,
                        id_token: account.id_token != null ? String(account.id_token) : null,
                        session_state: account.session_state != null ? String(account.session_state) : null,
                    },
                });
            } catch (updateErr) {
                console.warn("[AuthAdapter] Account update fallback notice:", updateErr);
            }
        }
        return account;
    },
    getUser: async (id: string) => {
        try {
            await ensureDatabaseTables();
            if (baseAdapter.getUser) {
                const u = await baseAdapter.getUser(id);
                if (u) return u;
            }
            return await prisma.user.findUnique({ where: { id } });
        } catch (err) {
            console.warn("[AuthAdapter] getUser notice:", err);
            return null;
        }
    },
    getUserByEmail: async (email: string) => {
        try {
            await ensureDatabaseTables();
            if (baseAdapter.getUserByEmail) {
                const u = await baseAdapter.getUserByEmail(email);
                if (u) return u;
            }
            return await prisma.user.findUnique({ where: { email } });
        } catch (err) {
            console.warn("[AuthAdapter] getUserByEmail notice:", err);
            return null;
        }
    },
    getUserByAccount: async (providerAccountId: Parameters<NonNullable<typeof baseAdapter.getUserByAccount>>[0]) => {
        try {
            await ensureDatabaseTables();
            if (baseAdapter.getUserByAccount) {
                const user = await baseAdapter.getUserByAccount(providerAccountId);
                if (user) return user;
            }
        } catch (err) {
            console.warn("[AuthAdapter] baseAdapter.getUserByAccount notice:", err);
        }

        try {
            const account = await prisma.account.findFirst({
                where: {
                    provider: providerAccountId.provider,
                    providerAccountId: providerAccountId.providerAccountId,
                },
                include: { user: true },
            });
            return account?.user ?? null;
        } catch (err) {
            console.warn("[AuthAdapter] manual getUserByAccount notice:", err);
            return null;
        }
    },
    updateUser: async (user: Parameters<NonNullable<typeof baseAdapter.updateUser>>[0]) => {
        try {
            await ensureDatabaseTables();
            if (baseAdapter.updateUser) {
                return await baseAdapter.updateUser(user);
            }
        } catch (err) {
            console.warn("[AuthAdapter] updateUser notice:", err);
        }
        return user as ReturnType<NonNullable<typeof baseAdapter.updateUser>> extends Promise<infer R> ? R : typeof user;
    },
    deleteUser: async (id: string) => {
        try {
            await ensureDatabaseTables();
            if (baseAdapter.deleteUser) {
                return await baseAdapter.deleteUser(id);
            }
        } catch (err) {
            console.warn("[AuthAdapter] deleteUser notice:", err);
        }
        return null;
    },
    unlinkAccount: async (providerAccountId: Parameters<NonNullable<typeof baseAdapter.unlinkAccount>>[0]) => {
        try {
            await ensureDatabaseTables();
            if (baseAdapter.unlinkAccount) {
                return await baseAdapter.unlinkAccount(providerAccountId);
            }
        } catch (err) {
            console.warn("[AuthAdapter] unlinkAccount notice:", err);
        }
        return undefined;
    },
    getAccount: async (providerAccountId: string, provider: string) => {
        try {
            await ensureDatabaseTables();
            if (baseAdapter.getAccount) {
                const account = await baseAdapter.getAccount(providerAccountId, provider);
                if (account) {
                    let accessToken = account.access_token;
                    let refreshToken = account.refresh_token;
                    try {
                        accessToken = account.access_token ? decryptToken(account.access_token) : account.access_token;
                    } catch { /* token may be plaintext or encrypted with different key */ }
                    try {
                        refreshToken = account.refresh_token ? decryptToken(account.refresh_token) : account.refresh_token;
                    } catch { /* token may be plaintext or encrypted with different key */ }
                    return {
                        ...account,
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    };
                }
            }
            const account = await prisma.account.findFirst({
                where: { providerAccountId, provider },
            });
            if (!account) return null;
            let accessToken = account.access_token;
            let refreshToken = account.refresh_token;
            try {
                accessToken = account.access_token ? decryptToken(account.access_token) : account.access_token;
            } catch { /* graceful fallback */ }
            try {
                refreshToken = account.refresh_token ? decryptToken(account.refresh_token) : account.refresh_token;
            } catch { /* graceful fallback */ }
            return {
                ...account,
                access_token: accessToken,
                refresh_token: refreshToken,
            };
        } catch (err) {
            console.warn("[AuthAdapter] getAccount notice:", err);
            return null;
        }
    },
} as unknown as ReturnType<typeof PrismaAdapter>;

export const secureAdapter = resilientAdapter;

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

const isMaskedOrPlaceholder = (val: string): boolean => {
    if (!val) return true;
    if (val.includes("*")) return true;
    const lower = val.toLowerCase();
    const placeholders = [
        "your_github_client_id",
        "your_github_client_secret",
        "dummy_client",
        "placeholder",
        "changeme",
        "<your_",
    ];
    return placeholders.some((p) => lower.includes(p));
};

export const isGithubConfigured = Boolean(
    rawGithubId &&
    rawGithubSecret &&
    !isMaskedOrPlaceholder(rawGithubId) &&
    !isMaskedOrPlaceholder(rawGithubSecret)
);

const allowGuest = isGuestMode();

// Build list of active authentication providers
const activeProviders = [];

if (isGithubConfigured) {
    activeProviders.push(
        GitHub({
            clientId: rawGithubId,
            clientSecret: rawGithubSecret,
            allowDangerousEmailAccountLinking: true,
            authorization: {
                params: {
                    scope: "read:user user:email repo",
                },
            },
        })
    );
} else {
    // Provide a safe placeholder GitHub provider so NextAuth routes exist
    // and can provide graceful redirection rather than throwing InvalidProvider
    activeProviders.push(
        GitHub({
            clientId: rawGithubId || "unconfigured",
            clientSecret: rawGithubSecret || "unconfigured",
            allowDangerousEmailAccountLinking: true,
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
                try {
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
                                id: "guest_user_default",
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
                } catch (guestDbErr) {
                    console.warn("[Auth] Guest authorize DB fallback:", guestDbErr);
                    return {
                        id: "guest_user_default",
                        name: "Guest User",
                        email: "guest@ocms.dev",
                    };
                }
            },
        })
    );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: resilientAdapter,
    trustHost: true,
    debug: process.env.NODE_ENV === "development" || Boolean(process.env.DEBUG_AUTH || process.env.VERCEL),
    secret: getAuthSecret(),
    session: {
        strategy: "jwt",
        // Ensure JWT sessions have a long maxAge so they persist across Vercel Lambda invocations
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    pages: {
        signIn: "/auth/signin",
        error: "/auth/error",
    },
    providers: activeProviders,
    callbacks: {
        signIn: async ({ user, account, profile }) => {
            try {
                if (account?.provider === "github" && !isGithubConfigured) {
                    console.warn("[Auth] GitHub OAuth attempted without valid unmasked credentials.");
                    return "/auth/error?error=Configuration";
                }
                // For GitHub provider: ensure user object is populated even if adapter failed
                if (account?.provider === "github" && profile) {
                    const ghProfile = profile as Record<string, unknown>;
                    if (!user.id) {
                        user.id = `gh_${account.providerAccountId}`;
                    }
                    if (!user.name && ghProfile.login) {
                        user.name = String(ghProfile.login);
                    }
                    if (!user.email && ghProfile.email) {
                        user.email = String(ghProfile.email);
                    }
                }
                return true;
            } catch (err) {
                console.error("[Auth] signIn callback error (allowing sign-in anyway for JWT):", err);
                // Return true to allow the JWT session to be created even if adapter had issues.
                // Since we use JWT strategy, the session is self-contained and doesn't require DB.
                return true;
            }
        },
        jwt: async ({ token, user, account }) => {
            try {
                if (user) {
                    token.id = user.id;
                    if (user.name) token.name = user.name;
                    if (user.email) token.email = user.email;
                    if (user.image) token.picture = user.image;
                }
                if (account?.access_token) {
                    token.accessToken = account.access_token;
                } else if (account?.provider === "guest") {
                    token.accessToken = "mock_token";
                }
            } catch (err) {
                console.error("[Auth] jwt callback error (returning partial token):", err);
            }
            return token;
        },
        session: async ({ session, token }) => {
            try {
                if (session.user && token) {
                    session.user.id = (token.id as string) || (token.sub as string) || "user";
                    // Note: OCMS is 100% free and open-source; no paid tiers or paywalls exist.
                    session.user.subscription = "free";
                }
                if (token?.accessToken) {
                    session.accessToken = token.accessToken as string;
                }
            } catch (err) {
                console.error("[Auth] session callback error:", err);
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
                    id: "guest_user_default",
                    name: "Guest User",
                    email: "guest@ocms.dev",
                }
            });
        }
        return guestUser.id;
    } catch (dbErr) {
        console.warn("[Auth] Database unwritable in guest mode, returning static guest ID:", dbErr);
        return "guest_user_default";
    }
}

export async function getAuthorizedSession() {
    try {
        return await auth();
    } catch {
        return null;
    }
}
