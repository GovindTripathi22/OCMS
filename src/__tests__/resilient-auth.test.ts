/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock("next-auth", () => ({
    __esModule: true,
    default: jest.fn().mockImplementation((config) => ({
        handlers: {},
        auth: jest.fn(),
        signIn: jest.fn(),
        signOut: jest.fn(),
        config,
    })),
}));

jest.mock("next-auth/providers/github", () => ({
    __esModule: true,
    default: jest.fn().mockImplementation((config) => ({ id: "github", name: "GitHub", type: "oauth", ...config })),
}));

jest.mock("next-auth/providers/credentials", () => ({
    __esModule: true,
    default: jest.fn().mockImplementation((config) => ({ id: "guest", name: "Guest Mode", type: "credentials", ...config })),
}));

jest.mock("@auth/prisma-adapter", () => ({
    __esModule: true,
    PrismaAdapter: jest.fn().mockImplementation((p) => ({
        createUser: (data: any) => p.user.create({ data }),
        getUser: (id: string) => p.user.findUnique({ where: { id } }),
        getUserByEmail: (email: string) => p.user.findUnique({ where: { email } }),
        getUserByAccount: (account: any) => p.account.findUnique({ where: account }).then((acc: any) => acc?.user ?? null),
        updateUser: (user: any) => p.user.update({ where: { id: user.id }, data: user }),
        deleteUser: (id: string) => p.user.delete({ where: { id } }),
        linkAccount: (data: any) => p.account.create({ data }),
        unlinkAccount: (acc: any) => p.account.delete({ where: acc }),
        getAccount: (providerAccountId: string, provider: string) => p.account.findFirst({ where: { providerAccountId, provider } }),
    })),
}));

import { resilientAdapter } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isPlaceholder } from "@/lib/env";
import { GET as checkEnvGet } from "@/app/api/check-env/route";

describe("Resilient NextAuth Adapter & GitHub OAuth Error Resilience", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("resilientAdapter.createUser", () => {
        it("returns the created user when baseAdapter succeeds", async () => {
            const mockUser = {
                id: "user-1",
                name: "Test User",
                email: "test@example.com",
                emailVerified: null,
            };
            jest.spyOn(prisma.user, "create").mockResolvedValue(mockUser as any);

            const result = await (resilientAdapter as any).createUser({
                name: "Test User",
                email: "test@example.com",
                emailVerified: null,
            });

            expect(result).toBeDefined();
            expect(result.email).toBe("test@example.com");
        });

        it("falls back to existing user if prisma.user.create throws duplicate error", async () => {
            const existingUser = {
                id: "existing-user-1",
                name: "Existing User",
                email: "existing@example.com",
                emailVerified: null,
                subscription: "FREE",
                generationsUsed: 0,
                generationsReset: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            jest.spyOn(prisma.user, "create").mockRejectedValue(new Error("Unique constraint failed on the fields: (email)"));
            jest.spyOn(prisma.user, "findFirst").mockResolvedValue(existingUser as any);

            const result = await (resilientAdapter as any).createUser({
                name: "Existing User",
                email: "existing@example.com",
                emailVerified: null,
            });

            expect(result).toBeDefined();
            expect(result.id).toBe("existing-user-1");
            expect(result.email).toBe("existing@example.com");
        });

        it("never throws even if database is completely read-only or offline (serverless resilience)", async () => {
            jest.spyOn(prisma.user, "create").mockRejectedValue(new Error("EROFS: read-only file system, open '/tmp/dev.db'"));
            jest.spyOn(prisma.user, "findFirst").mockRejectedValue(new Error("SQLITE_READONLY: attempt to write a readonly database"));

            const result = await (resilientAdapter as any).createUser({
                name: "Offline User",
                email: "offline@example.com",
                emailVerified: null,
            });

            // Must NOT throw: NextAuth v5 maps any throw in adapter to fatal Configuration error
            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(typeof result.id).toBe("string");
            expect(result.email).toBe("offline@example.com");
        });
    });

    describe("resilientAdapter.linkAccount", () => {
        it("returns account without throwing even if prisma.account.create throws duplicate key", async () => {
            const mockAccount = {
                provider: "github",
                providerAccountId: "gh-12345",
                type: "oauth" as const,
                userId: "user-1",
                access_token: "gho_test_token_123",
            };

            jest.spyOn(prisma.account, "create").mockRejectedValue(new Error("Unique constraint failed on the fields: (provider, providerAccountId)"));
            jest.spyOn(prisma.account, "updateMany").mockResolvedValue({ count: 1 });

            const result = await (resilientAdapter as any).linkAccount(mockAccount);

            expect(result).toBeDefined();
            expect(result.providerAccountId).toBe("gh-12345");
        });

        it("returns account without throwing if database write fails completely", async () => {
            const mockAccount = {
                provider: "github",
                providerAccountId: "gh-12345",
                type: "oauth" as const,
                userId: "user-1",
                access_token: "gho_test_token_123",
            };

            jest.spyOn(prisma.account, "create").mockRejectedValue(new Error("SQLITE_CANTOPEN"));
            jest.spyOn(prisma.account, "updateMany").mockRejectedValue(new Error("SQLITE_CANTOPEN"));

            const result = await (resilientAdapter as any).linkAccount(mockAccount);

            expect(result).toBeDefined();
            expect(result.provider).toBe("github");
        });
    });

    describe("resilientAdapter query methods safety", () => {
        it("getUserByAccount returns null safely when database throws", async () => {
            jest.spyOn(prisma.account, "findUnique").mockRejectedValue(new Error("Database disconnected"));
            jest.spyOn(prisma.account, "findFirst").mockRejectedValue(new Error("Database disconnected"));

            const result = await (resilientAdapter as any).getUserByAccount({
                provider: "github",
                providerAccountId: "gh-123",
            });

            expect(result).toBeNull();
        });

        it("getUserByEmail returns null safely when database throws", async () => {
            jest.spyOn(prisma.user, "findUnique").mockRejectedValue(new Error("Database table missing"));
            jest.spyOn(prisma.user, "findFirst").mockRejectedValue(new Error("Database table missing"));

            const result = await (resilientAdapter as any).getUserByEmail("missing@example.com");

            expect(result).toBeNull();
        });

        it("getUser returns null safely when database throws", async () => {
            jest.spyOn(prisma.user, "findUnique").mockRejectedValue(new Error("Database error"));

            const result = await (resilientAdapter as any).getUser("user-999");

            expect(result).toBeNull();
        });
    });

    describe("Masked Credential Detection & Placeholder Protection", () => {
        it("detects asterisks in copied client secret", () => {
            expect(isPlaceholder("ghp_************************************")).toBe(true);
            expect(isPlaceholder("*****")).toBe(true);
            expect(isPlaceholder("secret_with_***_mask")).toBe(true);
        });

        it("detects default placeholder strings", () => {
            expect(isPlaceholder("your_github_client_secret_here")).toBe(true);
            expect(isPlaceholder("dummy_client_secret")).toBe(true);
            expect(isPlaceholder("")).toBe(true);
            expect(isPlaceholder(undefined)).toBe(true);
        });

        it("allows valid secrets without placeholders or asterisks", () => {
            expect(isPlaceholder("b94f8a32d1e0c4b7a69834521098efab12345678")).toBe(false);
        });
    });

    describe("Check-Env API Route Diagnostics", () => {
        const originalEnv = process.env;

        beforeEach(() => {
            process.env = { ...originalEnv };
        });

        afterEach(() => {
            process.env = originalEnv;
        });

        it("detects masked secret and reports secretHasAsterisks flag", async () => {
            process.env.GITHUB_CLIENT_ID = "Ov23liRealId123";
            process.env.GITHUB_CLIENT_SECRET = "ghp_*****masked*****";
            process.env.AUTH_SECRET = "a_very_long_valid_secret_for_auth_32_chars";
            Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', writable: true });

            const res = await checkEnvGet();
            const data = await res.json();

            expect(data.secretHasAsterisks).toBe(true);
            expect(data.githubConfigured).toBe(false);
            expect(data.warnings).toContain("GITHUB_CLIENT_SECRET");
            expect(data.callbackUrl).toContain("/api/auth/callback/github");
        });

        it("reports githubConfigured as true when valid credentials exist without asterisks", async () => {
            process.env.GITHUB_CLIENT_ID = "Ov23liRealId123";
            process.env.GITHUB_CLIENT_SECRET = "b94f8a32d1e0c4b7a69834521098efab12345678";
            process.env.AUTH_SECRET = "a_very_long_valid_secret_for_auth_32_chars";

            const res = await checkEnvGet();
            const data = await res.json();

            expect(data.secretHasAsterisks).toBe(false);
            expect(data.githubConfigured).toBe(true);
            expect(data.callbackUrl).toContain("/api/auth/callback/github");
        });
    });
});
