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

export async function getAuthorizedUser(): Promise<string | null> {
    const session = await auth();
    let userId = session?.user?.id;

    if (!userId) {
        const isProduction = process.env.NODE_ENV === "production";
        const allowGuest = process.env.ALLOW_GUEST_ACCESS === "true";
        
        if (isProduction && !allowGuest) {
            return null;
        }

        // Fallback to Guest user in development or if explicitly allowed
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
    return userId;
}
