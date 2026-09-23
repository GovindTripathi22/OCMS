/**
 * Route-level integration tests
 * Directly tests API route handlers with NextRequest objects to verify security boundaries,
 * error handling, and status codes.
 */

const mockGetAuthorizedUser = jest.fn().mockResolvedValue("test-user-id");

jest.mock("@/auth", () => ({
    getAuthorizedUser: (...args: unknown[]) => mockGetAuthorizedUser(...args),
    auth: jest.fn().mockResolvedValue({ user: { id: "test-user-id" } }),
}));

jest.mock("@/lib/prisma", () => ({
    prisma: {
        project: {
            findUnique: jest.fn().mockResolvedValue(null),
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn(),
            update: jest.fn(),
        },
        account: {
            findFirst: jest.fn().mockResolvedValue(null),
        },
        user: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
        },
    },
}));

jest.mock("@octokit/rest", () => ({
    Octokit: jest.fn().mockImplementation(() => ({
        repos: {
            getContent: jest.fn(),
            createOrUpdateFileContents: jest.fn(),
        },
        pulls: {
            create: jest.fn(),
        },
        git: {
            getRef: jest.fn(),
            createRef: jest.fn(),
        },
    })),
}));

jest.mock("@/lib/ast-patcher", () => ({
    patchJSXWithReport: jest.fn().mockReturnValue({
        code: "<h1>patched</h1>",
        appliedCount: 1,
        matchedSelectors: [],
        unmatchedSelectors: [],
    }),
    patchJSX: jest.fn().mockReturnValue("<h1>patched</h1>"),
}));

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { POST as projectsPost } from "@/app/api/projects/route";
import { POST as publishPost } from "@/app/api/publish-changes/route";
import { POST as themeColorsPost } from "@/app/api/theme-colors/route";
import { POST as abVariantsPost } from "@/app/api/generate-ab-variant/route";
import { POST as inlineTextActionPost } from "@/app/api/inline-text-action/route";
import { POST as webhookPost } from "@/app/api/webhooks/github/route";
import { POST as voiceCommandPost } from "@/app/api/parse-voice-command/route";
import { POST as auditPost } from "@/app/api/lighthouse-audit/route";

function createMockRequest(url: string, body?: unknown, headers: Record<string, string> = {}): NextRequest {
    const init: RequestInit = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...headers,
        },
    };
    if (body !== undefined) {
        init.body = typeof body === "string" ? body : JSON.stringify(body);
    }
    return new NextRequest(new URL(url, "http://localhost:3000"), init as never);
}

describe("Route Integration Tests", () => {
    beforeEach(() => {
        mockGetAuthorizedUser.mockResolvedValue("test-user-id");
        (prisma.project.findUnique as jest.Mock).mockResolvedValue({
            id: "proj-1",
            userId: "test-user-id",
            name: "Test Project",
        });
    });

    describe("POST /api/projects", () => {
        it("returns 400 when name or url is missing", async () => {
            const req = createMockRequest("http://localhost:3000/api/projects", { name: "Test" });
            const res = await projectsPost(req);
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.errorCode || data.message).toBeDefined();
        });

        it("returns 400 for an invalid URL format", async () => {
            const req = createMockRequest("http://localhost:3000/api/projects", {
                name: "Test",
                url: "not-a-valid-url",
            });
            const res = await projectsPost(req);
            expect(res.status).toBe(400);
        });
    });

    describe("POST /api/publish-changes", () => {
        it("returns 401 when unauthorized", async () => {
            mockGetAuthorizedUser.mockResolvedValueOnce(null);
            const req = createMockRequest("http://localhost:3000/api/publish-changes", {
                projectId: "mock-proj",
                changes: [],
            });
            const res = await publishPost(req);
            expect(res.status).toBe(401);
        });
    });

    describe("POST /api/theme-colors", () => {
        it("rejects non-css file targets with 400", async () => {
            const req = createMockRequest("http://localhost:3000/api/theme-colors", {
                projectId: "proj-1",
                colors: ["#fff", "#000", "#111", "#222", "#333"],
                cssFilePath: "package.json",
            });
            const res = await themeColorsPost(req);
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.message || data.error).toContain("Only .css files");
        });

        it("rejects path traversal attempts with 403", async () => {
            const req = createMockRequest("http://localhost:3000/api/theme-colors", {
                projectId: "proj-1",
                colors: ["#fff", "#000", "#111", "#222", "#333"],
                cssFilePath: "../../../etc/passwd.css",
            });
            const res = await themeColorsPost(req);
            expect(res.status).toBe(403);
        });
    });

    describe("AI-Free mode restrictions", () => {
        it("POST /api/generate-ab-variant returns 501 in AI-free mode", async () => {
            const req = createMockRequest("http://localhost:3000/api/generate-ab-variant", {
                schema: [{ id: "f1", type: "text", selector: "h1", value: "Title" }],
                targetAudience: "casual",
            });
            const res = await abVariantsPost(req);
            expect(res.status).toBe(501);
            const data = await res.json();
            expect(data.message || data.error).toContain("AI-free mode");
        });

        it("POST /api/inline-text-action returns 501 for change-tone", async () => {
            const req = createMockRequest("http://localhost:3000/api/inline-text-action", {
                action: "change-tone",
                value: "Some sample text",
            });
            const res = await inlineTextActionPost(req);
            expect(res.status).toBe(501);
            const data = await res.json();
            expect(data.message || data.error).toContain("AI-free mode");
        });
    });

    describe("POST /api/webhooks/github", () => {
        it("returns 500 when secret is not configured or 401 when signature is invalid", async () => {
            const req = createMockRequest(
                "http://localhost:3000/api/webhooks/github",
                { ref: "refs/heads/main" },
                { "x-hub-signature-256": "sha256=invalid", "x-github-event": "push" }
            );
            const res = await webhookPost(req);
            expect([401, 500]).toContain(res.status);
        });
    });

    describe("POST /api/parse-voice-command", () => {
        it("returns 422 when no matching field is found instead of guessing", async () => {
            const req = createMockRequest("http://localhost:3000/api/parse-voice-command", {
                prompt: "unrelated command with no field mentions",
                schema: [
                    { id: "hero-title", type: "text", selector: "h1", value: "Hero" },
                    { id: "cta-link", type: "link", selector: "a", value: "/go" },
                ],
            });
            const res = await voiceCommandPost(req);
            expect(res.status).toBe(422);
            const data = await res.json();
            expect(data.errorCode || data.message || data.error).toBeDefined();
        });
    });

    describe("POST /api/lighthouse-audit", () => {
        it("returns 400 when neither URL nor HTML is provided", async () => {
            const req = createMockRequest("http://localhost:3000/api/lighthouse-audit", {});
            const res = await auditPost(req);
            expect(res.status).toBe(400);
        });
    });
});
