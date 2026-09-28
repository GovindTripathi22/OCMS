import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const mockGetAuthorizedUser = jest.fn().mockResolvedValue("test-user-id");

jest.mock("@/auth", () => ({
    getAuthorizedUser: (...args: unknown[]) => mockGetAuthorizedUser(...args),
    auth: jest.fn().mockResolvedValue({ user: { id: "test-user-id" } }),
}));

jest.mock("@/lib/auth-guards", () => ({
    requireAuthenticatedUser: jest.fn().mockResolvedValue({ userId: "test-user-id" }),
    requireOwnedProject: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
    prisma: {
        project: {
            findUnique: jest.fn(),
            update: jest.fn(),
            create: jest.fn(),
        },
        account: {
            findFirst: jest.fn(),
        },
    },
}));

jest.mock("@octokit/rest", () => ({
    Octokit: jest.fn().mockImplementation(() => ({
        repos: {
            getContent: jest.fn().mockResolvedValue({
                data: {
                    type: "file",
                    sha: "mock-sha-1",
                    content: Buffer.from("<h1>Hello World</h1>").toString("base64"),
                },
            }),
            createOrUpdateFileContents: jest.fn().mockResolvedValue({
                data: {
                    commit: {
                        sha: "commit-sha-123",
                        html_url: "https://github.com/owner/repo/commit/commit-sha-123",
                    },
                },
            }),
        },
        pulls: {
            create: jest.fn().mockResolvedValue({
                data: {
                    html_url: "https://github.com/owner/repo/pull/42",
                },
            }),
        },
        git: {
            getRef: jest.fn().mockResolvedValue({
                data: { object: { sha: "base-sha-1" } },
            }),
            createRef: jest.fn().mockResolvedValue({}),
        },
    })),
}));

jest.mock("@/lib/ast-patcher", () => ({
    patchJSXWithReport: jest.fn().mockReturnValue({
        code: "<h1>Hello Patched</h1>",
        appliedCount: 1,
        matchedSelectors: ["h1"],
        unmatchedSelectors: [],
    }),
}));

import { PUT as schemaPut } from "@/app/api/projects/[projectId]/schema/route";
import { POST as publishPost } from "@/app/api/publish-changes/route";
import { requireOwnedProject } from "@/lib/auth-guards";

function createMockRequest(url: string, method: string, body?: unknown): NextRequest {
    const init: RequestInit = {
        method,
        headers: {
            "Content-Type": "application/json",
            "host": "localhost:3000",
            "origin": "http://localhost:3000",
        },
    };
    if (body !== undefined) {
        init.body = typeof body === "string" ? body : JSON.stringify(body);
    }
    return new NextRequest(new URL(url, "http://localhost:3000"), init as never);
}

describe("Schema Revision Conflict & Force Resolution", () => {
    const mockProject = {
        id: "proj-rev-test",
        userId: "test-user-id",
        name: "Revision Test Project",
        schemaRevision: 1,
        generatedSchema: [
            { id: "field-1", type: "text", label: "Title", selector: "h1", value: "Server Title" },
        ],
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (requireOwnedProject as jest.Mock).mockResolvedValue({
            project: { ...mockProject },
        });
        (prisma.project.update as jest.Mock).mockImplementation(({ data }) => Promise.resolve({
            id: mockProject.id,
            generatedSchema: data.generatedSchema,
            schemaRevision: data.schemaRevision,
            updatedAt: new Date(),
        }));
    });

    it("returns HTTP 409 STALE_REVISION with serverRevision and serverSchema when client revision is stale", async () => {
        const req = createMockRequest("http://localhost:3000/api/projects/proj-rev-test/schema", "PUT", {
            schema: [{ id: "field-1", type: "text", label: "Title", selector: "h1", value: "Client Local Edit" }],
            clientRevision: 0, // Server is at 1
        });

        const res = await schemaPut(req, { params: { projectId: "proj-rev-test" } });
        expect(res.status).toBe(409);
        const data = await res.json();
        expect(data.errorCode).toBe("STALE_REVISION");
        expect(data.serverRevision).toBe(1);
        expect(Array.isArray(data.serverSchema)).toBe(true);
        expect(data.serverSchema).toHaveLength(1);
        expect(data.serverSchema[0].value).toBe("Server Title");
    });

    it("accepts PUT and increments revision when clientRevision matches serverRevision", async () => {
        const req = createMockRequest("http://localhost:3000/api/projects/proj-rev-test/schema", "PUT", {
            schema: [{ id: "field-1", type: "text", label: "Title", selector: "h1", value: "Client In-Sync Edit" }],
            clientRevision: 1, // Server is at 1
        });

        const res = await schemaPut(req, { params: { projectId: "proj-rev-test" } });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.schemaRevision).toBe(2);
    });

    it("accepts PUT and advances revision when force: true even if clientRevision is behind", async () => {
        const req = createMockRequest("http://localhost:3000/api/projects/proj-rev-test/schema", "PUT", {
            schema: [{ id: "field-1", type: "text", label: "Title", selector: "h1", value: "Force Overwrite Edit" }],
            clientRevision: 0, // Server is at 1, but force: true
            force: true,
        });

        const res = await schemaPut(req, { params: { projectId: "proj-rev-test" } });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.schemaRevision).toBe(2);
    });
});

describe("Graceful Schema Merge Strategy", () => {
    it("preserves local edits while incorporating new server fields", () => {
        const serverSchema = [
            { id: "hero-title", type: "text", label: "Hero", selector: "h1", value: "Original Title" },
            { id: "new-server-field", type: "text", label: "Subtitle", selector: "h2", value: "Discovered by scan" },
        ];
        const localSchema = [
            { id: "hero-title", type: "text", label: "Hero", selector: "h1", value: "User Custom Headline" },
        ];

        const localFieldMap = new Map(localSchema.map((f) => [f.id, f]));
        const mergedSchema = [...localSchema];
        for (const sf of serverSchema) {
            if (!localFieldMap.has(sf.id)) {
                mergedSchema.push(sf);
            }
        }

        expect(mergedSchema).toHaveLength(2);
        // User custom headline was preserved
        expect(mergedSchema.find(f => f.id === "hero-title")?.value).toBe("User Custom Headline");
        // Newly scanned field was added
        expect(mergedSchema.find(f => f.id === "new-server-field")?.value).toBe("Discovered by scan");
    });
});

describe("Publishing & Vercel Live Deployment Workflow", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (requireOwnedProject as jest.Mock).mockResolvedValue({
            project: {
                id: "proj-publish-test",
                userId: "test-user-id",
                name: "Publish Project",
                githubOwner: "test-owner",
                githubRepo: "test-repo",
                githubBranch: "main",
                targetFilePath: "src/app/page.tsx",
            },
        });
        (prisma.account.findFirst as jest.Mock).mockResolvedValue({
            userId: "test-user-id",
            provider: "github",
            access_token: "mock-encrypted-token",
        });
    });

    it("publishes directly to branch when directCommit: true and returns live deployment notice", async () => {
        const req = createMockRequest("http://localhost:3000/api/publish-changes", "POST", {
            projectId: "proj-publish-test",
            changes: [{ selector: "h1", type: "text", newValue: "Hello Live" }],
            directCommit: true,
        });

        const res = await publishPost(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.githubSynced).toBe(true);
        expect(data.isPullRequest).toBe(false);
        expect(data.commitUrl).toContain("/commit/");
        expect(data.deploymentNotice).toContain("Vercel is now automatically building");
    });

    it("creates Pull Request when directCommit is false on default branch and returns PR deployment notice", async () => {
        const req = createMockRequest("http://localhost:3000/api/publish-changes", "POST", {
            projectId: "proj-publish-test",
            changes: [{ selector: "h1", type: "text", newValue: "Hello PR" }],
            directCommit: false,
        });

        const res = await publishPost(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.githubSynced).toBe(true);
        expect(data.isPullRequest).toBe(true);
        expect(data.commitUrl).toContain("/pull/42");
        expect(data.deploymentNotice).toContain("Pull Request opened");
    });

    it("returns accurate branch push notice if PR creation fails on GitHub", async () => {
        const { Octokit } = jest.requireMock("@octokit/rest");
        Octokit.mockImplementationOnce(() => ({
            repos: {
                getContent: jest.fn().mockResolvedValue({
                    data: {
                        type: "file",
                        sha: "mock-sha-1",
                        content: Buffer.from("<h1>Hello World</h1>").toString("base64"),
                    },
                }),
                createOrUpdateFileContents: jest.fn().mockResolvedValue({
                    data: {
                        commit: {
                            sha: "commit-sha-456",
                            html_url: "https://github.com/owner/repo/commit/commit-sha-456",
                        },
                    },
                }),
            },
            pulls: {
                create: jest.fn().mockRejectedValue(new Error("A pull request already exists")),
            },
            git: {
                getRef: jest.fn().mockResolvedValue({
                    data: { object: { sha: "base-sha-1" } },
                }),
                createRef: jest.fn().mockResolvedValue({}),
            },
        }));

        const req = createMockRequest("http://localhost:3000/api/publish-changes", "POST", {
            projectId: "proj-publish-test",
            changes: [{ selector: "h1", type: "text", newValue: "Hello Branch Push" }],
            directCommit: false,
        });

        const res = await publishPost(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.isPullRequest).toBe(false);
        expect(data.deploymentNotice).toContain("Changes pushed to branch");
        expect(data.deploymentNotice).toContain("Create a Pull Request against");
    });

    it("returns HTTP 400 when repository owner or repo name is unconfigured", async () => {
        (requireOwnedProject as jest.Mock).mockResolvedValueOnce({
            project: {
                id: "proj-no-repo",
                userId: "test-user-id",
                name: "Unconfigured Project",
                githubOwner: null,
                githubRepo: null,
                targetFilePath: "src/app/page.tsx",
            },
        });

        const req = createMockRequest("http://localhost:3000/api/publish-changes", "POST", {
            projectId: "proj-no-repo",
            changes: [{ selector: "h1", type: "text", newValue: "Hello" }],
        });

        const res = await publishPost(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.success).toBe(false);
        expect(data.errors[0]).toContain("Repository owner and repository name are required");
    });
});
