import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedUser } from "@/auth";

export async function PATCH(
    req: NextRequest,
    { params }: { params: { projectId: string } }
) {
    try {
        const { githubOwner, githubRepo, githubBranch, targetFilePath, githubRepoUrl } = await req.json();

        const userId = await getAuthorizedUser();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const existingProject = await prisma.project.findFirst({
            where: {
                id: params.projectId,
                userId: userId
            }
        });

        if (!existingProject) {
            return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
        }

        const updatedData: Record<string, string> = {};
        if (githubOwner !== undefined) updatedData.githubOwner = githubOwner;
        if (githubRepo !== undefined) updatedData.githubRepo = githubRepo;
        if (githubBranch !== undefined) updatedData.githubBranch = githubBranch;
        if (targetFilePath !== undefined) updatedData.targetFilePath = targetFilePath;
        if (githubRepoUrl !== undefined) updatedData.githubRepoUrl = githubRepoUrl;

        const project = await prisma.project.update({
            where: { id: params.projectId },
            data: updatedData,
        });

        return NextResponse.json({ success: true, project });
    } catch (error: unknown) {
        console.error("Failed to update project settings:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { error: "Failed to update project settings", details: msg },
            { status: 500 }
        );
    }
}
