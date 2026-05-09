"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import ContentEditor from "@/components/workspace/ContentEditor";
import LivePreview from "@/components/workspace/LivePreview";
import type { SchemaField } from "./page";

interface WorkspaceClientProps {
    project: {
        id: string;
        githubOwner: string;
        githubRepo: string;
        targetFilePath: string;
        sourceUrl: string;
    };
    initialSchema: SchemaField[];
}

export default function WorkspaceClient({ project, initialSchema }: WorkspaceClientProps) {
    const [schema, setSchema] = useState<SchemaField[]>(initialSchema);
    const [history, setHistory] = useState<SchemaField[][]>([initialSchema]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [previewUrl, setPreviewUrl] = useState(project.sourceUrl);
    const [iframeLoaded, setIframeLoaded] = useState(false);

    // Ref to the iframe inside LivePreview
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // ── postMessage Live Bridge ──
    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe || !iframe.contentWindow || !iframeLoaded) return;

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
    }, [schema, iframeLoaded]);

    // ── Ghost SDK Broadcaster ──
    const broadcastGhostEvent = useCallback((type: "AI_EDIT_START" | "AI_EDIT_END", selector?: string, text?: string) => {
        const iframe = iframeRef.current;
        if (!iframe || !iframe.contentWindow || !iframeLoaded) return;

        iframe.contentWindow.postMessage(
            { source: "ocms-editor", type, selector, text },
            "*"
        );
    }, [iframeLoaded]);

    const handleFieldChange = useCallback((fieldId: string, newValue: string) => {
        setSchema((prev) => {
            const next = prev.map((f) => (f.id === fieldId ? { ...f, value: newValue } : f));
            // Update history
            setHistory(h => [...h.slice(0, historyIndex + 1), next]);
            setHistoryIndex(h => h + 1);
            return next;
        });
    }, [historyIndex]);

    const handleModelInjected = useCallback(
        (targetFieldId: string, modelPath: string) => {
            setSchema((prev) => {
                const next = prev.map((f) =>
                    f.id === targetFieldId
                        ? { ...f, type: "3d-model", value: modelPath }
                        : f
                );
                // Update history
                setHistory(h => [...h.slice(0, historyIndex + 1), next]);
                setHistoryIndex(h => h + 1);
                return next;
            });
        },
        [historyIndex]
    );

    const handleSchemaReplace = useCallback((newSchema: SchemaField[]) => {
        setSchema(newSchema);
        setHistory(h => [...h.slice(0, historyIndex + 1), newSchema]);
        setHistoryIndex(h => h + 1);
    }, [historyIndex]);

    const seekHistory = useCallback((percent: number) => {
        const index = Math.floor((percent / 100) * (history.length - 1));
        setHistoryIndex(index);
        setSchema(history[index]);
    }, [history]);

    return (
        <div className="fixed inset-0 pt-[56px] flex bg-[var(--ocms-bg)]">
            {/* Left Panel — Content Editor (30%) */}
            <div className="w-[30%] min-w-[320px] h-full border-r border-[var(--ocms-border)] overflow-y-auto">
                <ContentEditor
                    projectId={project.id}
                    schema={schema}
                    onFieldChange={handleFieldChange}
                    onModelInjected={handleModelInjected}
                    githubOwner={project.githubOwner}
                    githubRepo={project.githubRepo}
                    targetFilePath={project.targetFilePath}
                    onHistorySeek={seekHistory}
                    historyCount={history.length}
                    onSchemaReplace={handleSchemaReplace}
                    broadcastGhostEvent={broadcastGhostEvent}
                />
            </div>

            {/* Right Panel — Live Preview (70%) */}
            <div className="flex-1 h-full relative">
                <LivePreview
                    previewUrl={previewUrl}
                    onUrlChange={setPreviewUrl}
                    iframeRef={iframeRef}
                    onLoad={() => setIframeLoaded(true)}
                />
            </div>
        </div>
    );
}
