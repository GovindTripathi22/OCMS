import { Suspense } from "react";
import WorkspaceClient from "./WorkspaceClient";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export interface SchemaField {
    id: string;
    type: "text" | "image" | "link" | "3d-model";
    label: string;
    value: string;
    selector?: string;
    originalHtmlTag?: string;
}

// WorkspaceClient logic moved to its own file.

export default async function WorkspacePage({ params }: { params: { projectId: string } }) {
    const project = await prisma.project.findUnique({
        where: { id: params.projectId }
    });

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
        githubOwner: project.githubOwner || "GovindTripathi22",
        githubRepo: project.githubRepo || "OCMS",
        targetFilePath: project.targetFilePath || "src/app/page.tsx",
        sourceUrl: project.sourceUrl || "https://example.com"
    };

    return (
        <Suspense fallback={<div className="fixed inset-0 pt-[56px] flex items-center justify-center text-slate-400">Loading workspace...</div>}>
            <WorkspaceClient project={projectData} initialSchema={initialSchema} />
        </Suspense>
    );
}
