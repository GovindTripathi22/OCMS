"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import ContentEditor from "@/components/workspace/ContentEditor";
import LivePreview from "@/components/workspace/LivePreview";
import type { SchemaField } from "@/types/schema";


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
    const [isScanning, setIsScanning] = useState(false);

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const inlineEditRef = useRef(false);

    const handleScanPage = useCallback(async () => {
        const iframe = iframeRef.current;
        if (!iframe?.contentDocument) {
            alert("Preview is not loaded yet.");
            return;
        }

        setIsScanning(true);
        try {
            // Retrieve outer HTML directly from the iframe's loaded DOM!
            const html = iframe.contentDocument.documentElement.outerHTML;
            const currentUrl = previewUrl;

            const response = await fetch(`/api/projects/${project.id}/scan-page`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    url: currentUrl,
                    html: html
                }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to scan page");

            if (data.schema) {
                setSchema(data.schema);
                setHistory((prev) => [...prev.slice(0, historyIndex + 1), data.schema]);
                setHistoryIndex((prev) => prev + 1);
            }
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : "Failed to scan page";
            alert(errMsg);
        } finally {
            setIsScanning(false);
        }
    }, [project.id, previewUrl, historyIndex]);

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

    // Debounced autosave effect for persisting schema edits to database
    useEffect(() => {
        if (JSON.stringify(schema) === JSON.stringify(initialSchema)) return;

        const timer = setTimeout(async () => {
            try {
                const response = await fetch(`/api/projects/${project.id}/schema`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ schema }),
                });
                if (!response.ok) {
                    console.error("[Autosave] Failed to update project schema");
                }
            } catch (err) {
                console.error("[Autosave] Network error updating schema:", err);
            }
        }, 1500);

        return () => clearTimeout(timer);
    }, [schema, project.id, initialSchema]);

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

            if (source === "ocms-iframe-ready") {
                setIframeLoaded(true);
                
                // Update parent's previewUrl when navigation happens inside iframe
                const innerUrl = event.data.url;
                if (innerUrl) {
                    try {
                        const parsed = new URL(innerUrl);
                        const targetUrl = parsed.searchParams.get("url");
                        if (targetUrl && targetUrl !== previewUrl) {
                            setPreviewUrl(targetUrl);
                        }
                    } catch (e) {
                        console.error("[WorkspaceClient] Failed to parse navigated iframe URL:", e);
                    }
                }

                const changesPayload = schema
                    .filter((f) => f.selector)
                    .map((f) => ({
                        fieldId: f.id,
                        selector: f.selector,
                        type: f.type,
                        value: f.value,
                    }));
                iframeRef.current?.contentWindow?.postMessage(
                    { source: "ocms-live-bridge", changes: changesPayload },
                    "*"
                );
                return;
            }

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

            if (source === "ocms-inline-add-field" && event.data.field) {
                const newField = event.data.field;
                setSchema((prev) => {
                    if (prev.some((f) => f.id === newField.id || (f.selector === newField.selector && f.type === newField.type))) {
                        return prev;
                    }
                    const next = [...prev, newField];
                    setHistory((currentHistory) => {
                        return [...currentHistory.slice(0, historyIndex + 1), next];
                    });
                    setHistoryIndex((currentIndex) => currentIndex + 1);
                    return next;
                });
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
    }, [handleFieldChange, handleModelInjected, historyIndex, project.id, schema, previewUrl]);

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
        <div className="fixed inset-0 pt-16 flex flex-col bg-[var(--ocms-bg)] overflow-hidden">
            <div className="flex-1 flex flex-col lg:flex-row gap-3 p-3 lg:p-4 lg:gap-4 min-h-0">
                {/* ─── Sidebar Editor Panel ─── */}
                <div className="w-full lg:w-[340px] xl:w-[380px] h-[45vh] lg:h-full min-h-0 border-[3px] border-black lg:rounded-md lg:shadow-[5px_5px_0px_#000] bg-white overflow-y-auto flex flex-col transition-all duration-300 hover:shadow-[6px_6px_0px_var(--ocms-orange)] hover:translate-x-[-2px] hover:translate-y-[-2px]">
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
                        previewUrl={previewUrl}
                        isScanning={isScanning}
                        onScanPage={handleScanPage}
                    />
                </div>

                {/* ─── Preview Panel ─── */}
                <div className="flex-1 min-h-0 h-[55vh] lg:h-full relative border-[3px] border-black lg:rounded-md lg:shadow-[5px_5px_0px_#000] lg:overflow-hidden transition-all duration-300 hover:shadow-[6px_6px_0px_var(--ocms-orange)] hover:translate-x-[-2px] hover:translate-y-[-2px]">
                    <LivePreview
                        previewUrl={previewUrl}
                        onUrlChange={setPreviewUrl}
                        iframeRef={iframeRef}
                        onLoad={() => setIframeLoaded(true)}
                        projectId={project.id}
                    />
                </div>
            </div>
        </div>
    );
}
