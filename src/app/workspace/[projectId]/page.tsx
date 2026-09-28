import { Suspense } from "react";
import WorkspaceClient from "./WorkspaceClient";
import WorkspaceSkeleton from "@/components/workspace/WorkspaceSkeleton";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getAuthorizedUser } from "@/auth";
import type { SchemaField } from "@/types/schema";

export default async function WorkspacePage({ 
    params,
}: { 
    params: { projectId: string }
}) {
    const currentUserId = await getAuthorizedUser();

    if (!currentUserId) {
        redirect("/");
    }

    let project = null;
    try {
        project = await prisma.project.findUnique({
            where: { id: params.projectId }
        });
    } catch (e) {
        console.warn("Database lookup failed (ephemeral serverless environment):", e);
    }

    // IDOR Protection: If project exists in DB but belongs to a different user, deny access (404)
    if (project && project.userId !== currentUserId) {
        notFound();
    }

    // Safely parse the schema — no placeholder fallback in production.
    // If schema is empty, WorkspaceClient will hydrate from localStorage or prompt user to scan.
    let initialSchema: SchemaField[] = [];
    if (project?.generatedSchema) {
        try {
            const parsed = project.generatedSchema as unknown as SchemaField[];
            // Ensure it's a valid non-empty array before using it
            if (Array.isArray(parsed) && parsed.length > 0) {
                initialSchema = parsed;
            }
        } catch (e) {
            console.error("Failed to parse project schema:", e);
        }
    }

    const projectData = {
        id: project ? project.id : params.projectId,
        name: project ? project.name : "Workspace Project",
        githubOwner: project?.githubOwner ?? null,
        githubRepo: project?.githubRepo ?? null,
        githubBranch: project?.githubBranch || "main",
        targetFilePath: project?.targetFilePath ?? null,
        sourceUrl: project?.sourceUrl ?? null,
        schemaRevision: project?.schemaRevision ?? 0,
    };

    return (
        <Suspense fallback={<WorkspaceSkeleton />}>
            <WorkspaceClient project={projectData} initialSchema={initialSchema} />
        </Suspense>
    );
}
