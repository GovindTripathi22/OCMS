import { requireAuthenticatedUser, requireOwnedProject, requireOwnedAsset } from "@/lib/auth-guards";
import { getAuthorizedUser } from "@/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/auth", () => ({
    getAuthorizedUser: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
    prisma: {
        project: {
            findUnique: jest.fn(),
        },
        asset3D: {
            findUnique: jest.fn(),
        },
    },
}));

describe("auth-guards", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("requireAuthenticatedUser", () => {
        it("returns userId when user is authenticated", async () => {
            (getAuthorizedUser as jest.Mock).mockResolvedValue("user-123");
            const result = await requireAuthenticatedUser();
            expect(result.userId).toBe("user-123");
            expect(result.error).toBeNull();
        });

        it("returns 401 UNAUTHORIZED when no user is found", async () => {
            (getAuthorizedUser as jest.Mock).mockResolvedValue(null);
            const result = await requireAuthenticatedUser();
            expect(result.userId).toBeNull();
            expect(result.error?.status).toBe(401);
            expect(result.error?.code).toBe("UNAUTHORIZED");
        });
    });

    describe("requireOwnedProject", () => {
        it("returns project when owned by user", async () => {
            const mockProject = { id: "proj-1", userId: "user-123", name: "Test Proj" };
            (prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);

            const result = await requireOwnedProject("proj-1", "user-123");
            expect(result.project).toEqual(mockProject);
            expect(result.error).toBeNull();
        });

        it("returns 404 when project does not exist", async () => {
            (prisma.project.findUnique as jest.Mock).mockResolvedValue(null);

            const result = await requireOwnedProject("proj-missing", "user-123");
            expect(result.project).toBeNull();
            expect(result.error?.status).toBe(404);
            expect(result.error?.code).toBe("NOT_FOUND");
        });

        it("returns 403 FORBIDDEN when project belongs to another user (IDOR prevention)", async () => {
            const mockProject = { id: "proj-1", userId: "attacker-user", name: "Test Proj" };
            (prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);

            const result = await requireOwnedProject("proj-1", "victim-user");
            expect(result.project).toBeNull();
            expect(result.error?.status).toBe(403);
            expect(result.error?.code).toBe("FORBIDDEN");
        });

        it("returns 400 when projectId is empty", async () => {
            const result = await requireOwnedProject("", "user-123");
            expect(result.project).toBeNull();
            expect(result.error?.status).toBe(400);
        });
    });

    describe("requireOwnedAsset", () => {
        it("returns asset when parent project belongs to user", async () => {
            const mockAsset = {
                id: "asset-1",
                projectId: "proj-1",
                project: { id: "proj-1", userId: "user-123" },
            };
            (prisma.asset3D.findUnique as jest.Mock).mockResolvedValue(mockAsset);

            const result = await requireOwnedAsset("asset-1", "user-123");
            expect(result.asset).toEqual(mockAsset);
            expect(result.error).toBeNull();
        });

        it("returns 403 when asset parent project belongs to another user", async () => {
            const mockAsset = {
                id: "asset-1",
                projectId: "proj-1",
                project: { id: "proj-1", userId: "another-user" },
            };
            (prisma.asset3D.findUnique as jest.Mock).mockResolvedValue(mockAsset);

            const result = await requireOwnedAsset("asset-1", "user-123");
            expect(result.asset).toBeNull();
            expect(result.error?.status).toBe(403);
            expect(result.error?.code).toBe("FORBIDDEN");
        });
    });
});
