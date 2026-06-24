import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PUT(
    req: NextRequest,
    { params }: { params: { projectId: string } }
) {
    try {
        const { schema } = await req.json();
        
        if (!schema) {
            return NextResponse.json({ error: "Schema is required" }, { status: 400 });
        }

        const session = await auth();
        let userId = session?.user?.id;

        if (!userId) {
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
