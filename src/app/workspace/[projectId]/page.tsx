"use client";

import { useParams } from "next/navigation";
import { useState, useCallback } from "react";
import ContentEditor from "@/components/workspace/ContentEditor";
import LivePreview from "@/components/workspace/LivePreview";

export interface SchemaField {
    id: string;
    type: "text" | "image" | "link" | "3d-model";
    label: string;
    value: string;
    selector?: string;
    originalHtmlTag?: string;
}

export default function WorkspacePage() {
    const params = useParams();
    const projectId = params.projectId as string;

    const [schema, setSchema] = useState<SchemaField[]>([
        { id: "hero-title", type: "text", label: "Hero Title", value: "Welcome to Our Site" },
        { id: "hero-subtitle", type: "text", label: "Subtitle", value: "Build something amazing today." },
        { id: "hero-image", type: "image", label: "Hero Image", value: "/placeholder.jpg" },
        { id: "cta-link", type: "link", label: "CTA Link", value: "/get-started" },
    ]);

    const [previewUrl, setPreviewUrl] = useState("https://example.com");

    const handleFieldChange = useCallback((fieldId: string, newValue: string) => {
        setSchema((prev) =>
            prev.map((f) => (f.id === fieldId ? { ...f, value: newValue } : f))
        );
    }, []);

    const handleModelInjected = useCallback(
        (targetFieldId: string, modelPath: string) => {
            setSchema((prev) =>
                prev.map((f) =>
                    f.id === targetFieldId
                        ? { ...f, type: "3d-model", value: modelPath }
                        : f
                )
            );
        },
        []
    );

    return (
        <div className="fixed inset-0 pt-[72px] flex bg-[var(--ocms-bg)]">
            {/* Left Panel — Content Editor (30%) */}
            <div className="w-[30%] min-w-[320px] h-full border-r border-[var(--ocms-border)] overflow-y-auto">
                <ContentEditor
                    projectId={projectId}
                    schema={schema}
                    onFieldChange={handleFieldChange}
                    onModelInjected={handleModelInjected}
                />
            </div>

            {/* Right Panel — Live Preview (70%) */}
            <div className="flex-1 h-full relative">
                <LivePreview
                    previewUrl={previewUrl}
                    onUrlChange={setPreviewUrl}
                />
            </div>
        </div>
    );
}
