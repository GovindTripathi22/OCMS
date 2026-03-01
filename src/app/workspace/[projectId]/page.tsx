"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useState, useCallback, useRef, useEffect, Suspense } from "react";
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

function WorkspaceClient() {
    const params = useParams();
    const searchParams = useSearchParams();
    const projectId = params.projectId as string;

    const [schema, setSchema] = useState<SchemaField[]>([
        { id: "hero-title", type: "text", label: "Hero Title", value: "Welcome to Our Site", selector: "h1" },
        { id: "hero-subtitle", type: "text", label: "Subtitle", value: "Build something amazing today.", selector: ".subtitle" },
        { id: "hero-image", type: "image", label: "Hero Image", value: "/placeholder.jpg", selector: "img.hero" },
        { id: "cta-link", type: "link", label: "CTA Link", value: "/get-started", selector: "a.cta" },
    ]);

    const initialUrl = searchParams.get("target") || "https://example.com";
    const [previewUrl, setPreviewUrl] = useState(initialUrl);

    // Ref to the iframe inside LivePreview
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // ── postMessage Live Bridge ──
    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe || !iframe.contentWindow) return;

        const changesPayload = schema.map((f) => ({
            fieldId: f.id,
            selector: f.selector,
            type: f.type,
            value: f.value,
        }));

        iframe.contentWindow.postMessage(
            { source: "ocms-live-bridge", changes: changesPayload },
            "*"
        );
    }, [schema]);

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
        <div className="fixed inset-0 pt-[56px] flex bg-[var(--ocms-bg)]">
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
                    iframeRef={iframeRef}
                />
            </div>
        </div>
    );
}

export default function WorkspacePage() {
    return (
        <Suspense fallback={<div className="fixed inset-0 pt-[56px] flex items-center justify-center text-slate-400">Loading workspace...</div>}>
            <WorkspaceClient />
        </Suspense>
    );
}
