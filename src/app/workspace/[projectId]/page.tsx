import { Suspense } from "react";
import WorkspaceClient from "./WorkspaceClient";
import WorkspaceSkeleton from "@/components/workspace/WorkspaceSkeleton";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getAuthorizedUser } from "@/auth";
import type { SchemaField } from "@/types/schema";

export default async function WorkspacePage({ 
    params,
    searchParams 
}: { 
    params: { projectId: string },
    searchParams: { target?: string }
}) {
    const currentUserId = await getAuthorizedUser();

    if (!currentUserId) {
        redirect("/");
    }

    let project = await prisma.project.findUnique({
        where: { id: params.projectId }
    });

    // IDOR Protection: If project exists but belongs to a different user, deny access (404)
    if (project && project.userId !== currentUserId) {
        notFound();
    }

    const targetUrl = searchParams.target;

    if (!project && targetUrl) {
        project = await prisma.project.create({
            data: {
                id: params.projectId, 
                name: "Auto-Recovered Project",
                sourceUrl: targetUrl,
                userId: currentUserId
            }
        });
    }


    if (!project) {
        notFound();
    }

    // Safely parse the schema or use fallback
    let initialSchema: SchemaField[] = [];
    try {
        if (project.generatedSchema) {
            initialSchema = project.generatedSchema as unknown as SchemaField[];
        }
    } catch (e) {
        console.error("Failed to parse schema", e);
    }

    // Default schema if none generated
    if (!initialSchema || initialSchema.length === 0) {
        initialSchema = [
            { id: "hero-title", type: "text", label: "Hero Title", value: "Welcome to Our Site", selector: "h1" },
            { id: "hero-subtitle", type: "text", label: "Subtitle", value: "Build something amazing today.", selector: ".subtitle" },
            { id: "hero-image", type: "image", label: "Hero Image", value: "/placeholder.jpg", selector: "img.hero" },
            { id: "cta-link", type: "link", label: "CTA Link", value: "/get-started", selector: "a.cta" },
        ];
    }

    const projectData = {
        id: project.id,
        githubOwner: project.githubOwner || "",
        githubRepo: project.githubRepo || "",
        targetFilePath: project.targetFilePath || "",
        sourceUrl: project.sourceUrl || ""
    };

    return (
        <Suspense fallback={<WorkspaceSkeleton />}>
            <WorkspaceClient project={projectData} initialSchema={initialSchema} />
        </Suspense>
    );
}

