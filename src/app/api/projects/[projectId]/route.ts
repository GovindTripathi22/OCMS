import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser, requireOwnedProject } from "@/lib/auth-guards";
import { validateMutationOrigin } from "@/lib/csrf";
import {
    createErrorResponse,
    parseJsonSafely,
    validateProjectName,
    validateRepoString,
    LIMITS,
} from "@/lib/validation";
import path from "path";

function parseGitHubUrl(urlStr: string): { owner: string; repo: string } | null {
    try {
        const url = new URL(urlStr);
        if (url.hostname !== "github.com") return null;
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
            const owner = parts[0];
            const repo = parts[1].replace(/\.git$/, "");
            return { owner, repo };
        }
        return null;
    } catch {
        return null;
    }
}

export async function GET(
    _req: NextRequest,
    { params }: { params: { projectId: string } }
) {
    const authCheck = await requireAuthenticatedUser();
    if (authCheck.error) {
        return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
    }
    const userId = authCheck.userId;

    const projectCheck = await requireOwnedProject(params.projectId, userId);
    if (projectCheck.error) {
        return createErrorResponse(projectCheck.error.code, projectCheck.error.message, projectCheck.error.status);
    }

    return NextResponse.json({ success: true, project: projectCheck.project });
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: { projectId: string } }
) {
    const csrfError = validateMutationOrigin(req);
    if (csrfError) return csrfError;

    const authCheck = await requireAuthenticatedUser();
    if (authCheck.error) {
        return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
    }
    const userId = authCheck.userId;

    const projectCheck = await requireOwnedProject(params.projectId, userId);
    if (projectCheck.error) {
        return createErrorResponse(projectCheck.error.code, projectCheck.error.message, projectCheck.error.status);
    }

    const { data, error: jsonError } = await parseJsonSafely<Record<string, unknown>>(req, 10 * 1024);
    if (jsonError) return jsonError;

    const updatedData: Record<string, string> = {};

    if ("name" in (data || {})) {
        const nameVal = validateProjectName(data?.name);
        if (!nameVal.valid) {
            return createErrorResponse("INVALID_NAME", nameVal.error || "Invalid project name", 400);
        }
        updatedData.name = String(data?.name).trim().slice(0, LIMITS.PROJECT_NAME_MAX_LENGTH);
    }

    let resolvedOwner = data?.githubOwner ? String(data.githubOwner).trim() : undefined;
    let resolvedRepo = data?.githubRepo ? String(data.githubRepo).trim() : undefined;

    if (data?.githubRepoUrl && typeof data.githubRepoUrl === "string") {
        const parsed = parseGitHubUrl(data.githubRepoUrl.trim());
        if (parsed) {
            if (resolvedOwner && resolvedOwner !== parsed.owner) {
                return createErrorResponse("INCONSISTENT_CONFIG", "githubOwner does not match owner in githubRepoUrl", 400);
            }
            if (resolvedRepo && resolvedRepo !== parsed.repo) {
                return createErrorResponse("INCONSISTENT_CONFIG", "githubRepo does not match repository in githubRepoUrl", 400);
            }
            resolvedOwner = parsed.owner;
            resolvedRepo = parsed.repo;
            updatedData.githubRepoUrl = data.githubRepoUrl.trim();
        }
    }

    if (resolvedOwner !== undefined) {
        const ownerVal = validateRepoString(resolvedOwner, "githubOwner");
        if (!ownerVal.valid) {
            return createErrorResponse("INVALID_REPO_OWNER", ownerVal.error || "Invalid githubOwner", 400);
        }
        updatedData.githubOwner = resolvedOwner;
    }

    if (resolvedRepo !== undefined) {
        const repoVal = validateRepoString(resolvedRepo, "githubRepo");
        if (!repoVal.valid) {
            return createErrorResponse("INVALID_REPO_NAME", repoVal.error || "Invalid githubRepo", 400);
        }
        updatedData.githubRepo = resolvedRepo;
    }

    if (data?.githubBranch !== undefined) {
        const branch = String(data.githubBranch).trim();
        if (!branch || branch.includes("..") || branch.includes("~") || branch.includes("^")) {
            return createErrorResponse("INVALID_BRANCH", "Invalid git branch name", 400);
        }
        updatedData.githubBranch = branch;
    }

    if (data?.targetFilePath !== undefined) {
        const rawPath = String(data.targetFilePath).trim();
        if (rawPath.length > LIMITS.CSS_PATH_MAX_LENGTH) {
            return createErrorResponse("INVALID_PATH", "targetFilePath exceeds maximum length", 400);
        }
        const norm = path.normalize(rawPath);
        if (path.isAbsolute(norm) || norm.startsWith("..") || norm.includes(`..${path.sep}`)) {
            return createErrorResponse("PATH_TRAVERSAL_BLOCKED", "Path traversal in targetFilePath is forbidden", 400);
        }
        updatedData.targetFilePath = norm.replace(/\\/g, "/");
    }

    try {
        const project = await prisma.project.update({
            where: { id: params.projectId },
            data: updatedData,
        });

        return NextResponse.json({ success: true, project });
    } catch (error: unknown) {
        console.error("Failed to update project settings:", error);
        return createErrorResponse("DB_ERROR", "Failed to update project settings", 500);
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: { projectId: string } }
) {
    const csrfError = validateMutationOrigin(req);
    if (csrfError) return csrfError;

    const authCheck = await requireAuthenticatedUser();
    if (authCheck.error) {
        return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
    }
    const userId = authCheck.userId;

    const projectCheck = await requireOwnedProject(params.projectId, userId);
    if (projectCheck.error) {
        return createErrorResponse(projectCheck.error.code, projectCheck.error.message, projectCheck.error.status);
    }

    try {
        await prisma.project.delete({
            where: { id: params.projectId },
        });

        return NextResponse.json({ success: true, message: "Project deleted successfully" });
    } catch (error) {
        console.error("Failed to delete project:", error);
        return createErrorResponse("DB_ERROR", "Failed to delete project", 500);
    }
}
