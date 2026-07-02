import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedUser } from "@/auth";

export async function PUT(
    req: NextRequest,
    { params }: { params: { projectId: string } }
) {
    try {
        const { schema } = await req.json();
        
        if (!schema) {
            return NextResponse.json({ error: "Schema is required" }, { status: 400 });
        }

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

        const project = await prisma.project.update({
            where: { id: params.projectId },
            data: {
                generatedSchema: schema,
            },
        });

        return NextResponse.json({ success: true, project });
    } catch (error: unknown) {
        console.error("Failed to update project schema:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { error: "Failed to update project schema", details: msg },
            { status: 500 }
        );
    }
}
