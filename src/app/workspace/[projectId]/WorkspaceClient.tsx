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

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const inlineEditRef = useRef(false);

    const pushHistory = useCallback((next: SchemaField[]) => {
        setHistory((currentHistory) => [
            ...currentHistory.slice(0, historyIndex + 1),
            next,
        ]);
        setHistoryIndex((currentIndex) => currentIndex + 1);
    }, [historyIndex]);

    const handleFieldChange = useCallback((fieldId: string, newValue: string) => {
        setSchema((prev) => {
            const currentField = prev.find((f) => f.id === fieldId);
            if (!currentField || currentField.value === newValue) return prev;

            const next = prev.map((f) => (f.id === fieldId ? { ...f, value: newValue } : f));
            if (!inlineEditRef.current) pushHistory(next);
            return next;
        });
    }, [pushHistory]);

    const handleModelInjected = useCallback((targetFieldId: string, modelPath: string) => {
        setSchema((prev) => {
            const next = prev.map((f) =>
                f.id === targetFieldId
                    ? { ...f, type: "3d-model" as const, value: modelPath }
                    : f
            );
            pushHistory(next);
            return next;
        });
    }, [pushHistory]);

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe?.contentWindow || !iframeLoaded) return;

        const changesPayload = schema
            .filter((f) => f.selector)
            .map((f) => ({
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

    const broadcastGhostEvent = useCallback((type: "AI_EDIT_START" | "AI_EDIT_END", selector?: string, text?: string) => {
        const iframe = iframeRef.current;
        if (!iframe?.contentWindow || !iframeLoaded) return;

        iframe.contentWindow.postMessage(
            { source: "ocms-editor", type, selector, text },
            "*"
        );
    }, [iframeLoaded]);

    useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            if (event.source !== iframeRef.current?.contentWindow) return;

            const { source, fieldId, newValue, file, action, value } = event.data;

            if (source === "ocms-inline-edit") {
                inlineEditRef.current = true;
                handleFieldChange(fieldId, newValue);
                inlineEditRef.current = false;
                setHistory((currentHistory) => {
                    const base = currentHistory[historyIndex] ?? schema;
                    const next = base.map((f) => (f.id === fieldId ? { ...f, value: newValue } : f));
                    return [...currentHistory.slice(0, historyIndex + 1), next];
                });
                setHistoryIndex((currentIndex) => currentIndex + 1);
            }

            if (source === "ocms-model-drop" && file instanceof File) {
                const targetFieldId =
                    fieldId ||
                    schema.find((f) => f.type === "3d-model")?.id ||
                    schema.find((f) => f.type === "image")?.id ||
                    schema[0]?.id;

                if (!targetFieldId) return;

                const formData = new FormData();
                formData.append("model", file);
                formData.append("projectId", project.id);

                const response = await fetch("/api/upload-model", {
                    method: "POST",
                    body: formData,
                });

                if (!response.ok) return;
                const asset = await response.json();
                handleModelInjected(targetFieldId, asset.path || asset.urlHighPoly);
            }

            if (source === "ocms-toolbar-action" && fieldId && value) {
                const response = await fetch("/api/inline-ai-action", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action, value }),
                });

                if (!response.ok) return;
                const data = await response.json();
                if (data.value) handleFieldChange(fieldId, data.value);
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [handleFieldChange, handleModelInjected, historyIndex, project.id, schema]);

    const handleSchemaReplace = useCallback((newSchema: SchemaField[]) => {
        setSchema(newSchema);
        pushHistory(newSchema);
    }, [pushHistory]);

    const seekHistory = useCallback((percent: number) => {
        const index = Math.floor((percent / 100) * (history.length - 1));
        setHistoryIndex(index);
        setSchema(history[index]);
    }, [history]);

    return (
        <div className="fixed inset-0 pt-[56px] flex flex-col lg:flex-row bg-[var(--ocms-bg)]">
            <div className="w-full lg:w-[30%] lg:min-w-[320px] h-[45vh] lg:h-full min-h-0 border-b lg:border-b-0 lg:border-r border-[var(--ocms-border)] overflow-y-auto">
                <ContentEditor
                    projectId={project.id}
                    schema={schema}
                    initialSchema={initialSchema}
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

            <div className="flex-1 min-h-0 h-[55vh] lg:h-full relative">
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
