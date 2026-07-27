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

const baseAdapter = PrismaAdapter(prisma);

type CreateUserParam = Parameters<NonNullable<typeof baseAdapter.createUser>>[0];
type GetAccountParam = Parameters<NonNullable<typeof baseAdapter.getUserByAccount>>[0];
type LinkAccountParam = Parameters<NonNullable<typeof baseAdapter.linkAccount>>[0];

const resilientAdapter = {
    ...baseAdapter,
    createUser: async (data: CreateUserParam) => {
        try {
            return await baseAdapter.createUser!(data);
        } catch (e) {
            console.warn("[Auth] DB createUser bypassed (No active DB):", e);
            return { ...data, id: data.id || data.email || "jwt-user-id" };
        }
    },
    getUser: async (id: string) => {
        try {
            return await baseAdapter.getUser!(id);
        } catch {
            return null;
        }
    },
    getUserByEmail: async (email: string) => {
        try {
            return await baseAdapter.getUserByEmail!(email);
        } catch {
            return null;
        }
    },
    getUserByAccount: async (provider_providerAccountId: GetAccountParam) => {
        try {
            return await baseAdapter.getUserByAccount!(provider_providerAccountId);
        } catch {
            return null;
        }
    },
    linkAccount: async (data: LinkAccountParam) => {
        try {
            return await baseAdapter.linkAccount!(data);
        } catch (e) {
            console.warn("[Auth] DB linkAccount bypassed (No active DB):", e);
            return;
        }
    },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: resilientAdapter as unknown as import("next-auth/adapters").Adapter,
    secret: process.env.AUTH_SECRET || "ocms_dev_fallback_secret_key_12345",
    session: {
        strategy: "jwt",
    },
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
