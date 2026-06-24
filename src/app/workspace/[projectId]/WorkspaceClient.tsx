"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import ContentEditor from "@/components/workspace/ContentEditor";
import LivePreview from "@/components/workspace/LivePreview";
import type { SchemaField } from "@/types/schema";
import { PBR_PRESETS } from "@/lib/pbr-presets";


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

    const [editingField, setEditingField] = useState<SchemaField | null>(null);
    const [modalAlt, setModalAlt] = useState("");
    const [modalObjectFit, setModalObjectFit] = useState("");
    const [modalBorderRadius, setModalBorderRadius] = useState("");
    const [modalValue, setModalValue] = useState("");
    const [modalRoughness, setModalRoughness] = useState(0.5);
    const [modalMetalness, setModalMetalness] = useState(1.0);
    const [modalTextureUrl, setModalTextureUrl] = useState("");

    const pushHistory = useCallback((next: SchemaField[]) => {
        setHistory((currentHistory) => [
            ...currentHistory.slice(0, historyIndex + 1),
            next,
        ]);
        setHistoryIndex((currentIndex) => currentIndex + 1);
    }, [historyIndex]);

    const handleFieldUpdate = useCallback((fieldId: string, updates: Partial<SchemaField>) => {
        setSchema((prev) => {
            const currentField = prev.find((f) => f.id === fieldId);
            if (!currentField) return prev;

            const next = prev.map((f) => (f.id === fieldId ? { ...f, ...updates } : f));
            pushHistory(next);
            return next;
        });
    }, [pushHistory]);

    useEffect(() => {
        if (editingField) {
            setModalAlt(editingField.alt || "");
            setModalObjectFit(editingField.objectFit || "cover");
            setModalBorderRadius(editingField.borderRadius || "none");
            setModalValue(editingField.value || "");
            setModalRoughness(editingField.roughness !== undefined ? editingField.roughness : 0.5);
            setModalMetalness(editingField.metalness !== undefined ? editingField.metalness : 1.0);
            setModalTextureUrl(editingField.textureUrl || "");
        }
    }, [editingField]);

    const handleSaveModal = () => {
        if (!editingField) return;
        
        const updates: Partial<SchemaField> = {
            value: modalValue,
            alt: modalAlt,
            objectFit: modalObjectFit,
            borderRadius: modalBorderRadius,
            roughness: modalRoughness,
            metalness: modalMetalness,
            textureUrl: modalTextureUrl,
        };
        
        setSchema((prev) => {
            const next = prev.map((f) => (f.id === editingField.id ? { ...f, ...updates } : f));
            pushHistory(next);
            return next;
        });
        
        setEditingField(null);
    };

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
                alt: f.alt,
                objectFit: f.objectFit,
                borderRadius: f.borderRadius,
                roughness: f.roughness,
                metalness: f.metalness,
                textureUrl: f.textureUrl,
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
                        alt: f.alt,
                        objectFit: f.objectFit,
                        borderRadius: f.borderRadius,
                        roughness: f.roughness,
                        metalness: f.metalness,
                        textureUrl: f.textureUrl,
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

            if (source === "ocms-doubleclick-image" && event.data.field) {
                setEditingField(event.data.field);
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
                const response = await fetch("/api/inline-text-action", {
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
                        onFieldUpdate={handleFieldUpdate}
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

            {/* Element Options Modal */}
            {editingField && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-[#fcfbf9] border-[4px] border-black rounded-xl shadow-[8px_8px_0px_#000] p-6 text-black relative animate-fade-in">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-4 border-b-2 border-black mb-4">
                            <h3 className="text-base font-black uppercase tracking-tight">
                                ⚙️ {editingField.type === "3d-model" ? "3D Model Options" : "Image Options"}
                            </h3>
                            <button
                                onClick={() => setEditingField(null)}
                                className="w-8 h-8 flex items-center justify-center border-2 border-black rounded-md bg-white hover:bg-[var(--ocms-orange)] hover:text-white transition-all shadow-[2px_2px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px]"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body */}
                        <div className="space-y-4">
                            {/* Type Specific Fields */}
                            {editingField.type === "image" && (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-wider">Image Source URL</label>
                                        <input
                                            type="text"
                                            value={modalValue}
                                            onChange={(e) => setModalValue(e.target.value)}
                                            className="w-full bg-white border-[3px] border-black rounded-md px-3 py-2 text-xs outline-none focus:shadow-[2px_2px_0px_var(--ocms-cyan)] font-mono font-bold"
                                            placeholder="https://..."
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-wider">Alt Text (SEO)</label>
                                        <input
                                            type="text"
                                            value={modalAlt}
                                            onChange={(e) => setModalAlt(e.target.value)}
                                            className="w-full bg-white border-[3px] border-black rounded-md px-3 py-2 text-xs outline-none focus:shadow-[2px_2px_0px_var(--ocms-cyan)] font-bold"
                                            placeholder="Image description..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase tracking-wider">Object Fit</label>
                                            <select
                                                value={modalObjectFit}
                                                onChange={(e) => setModalObjectFit(e.target.value)}
                                                className="w-full bg-white border-[3px] border-black rounded-md px-3 py-2 text-xs outline-none focus:shadow-[2px_2px_0px_var(--ocms-cyan)] font-bold"
                                            >
                                                <option value="cover">Cover</option>
                                                <option value="contain">Contain</option>
                                                <option value="fill">Fill</option>
                                                <option value="none">None</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase tracking-wider">Border Corners</label>
                                            <select
                                                value={modalBorderRadius}
                                                onChange={(e) => setModalBorderRadius(e.target.value)}
                                                className="w-full bg-white border-[3px] border-black rounded-md px-3 py-2 text-xs outline-none focus:shadow-[2px_2px_0px_var(--ocms-cyan)] font-bold"
                                            >
                                                <option value="none">Sharp (None)</option>
                                                <option value="4px">Rounded Small</option>
                                                <option value="8px">Rounded Medium</option>
                                                <option value="16px">Rounded Large</option>
                                                <option value="9999px">Circle (Full)</option>
                                            </select>
                                        </div>
                                    </div>
                                </>
                            )}

                            {editingField.type === "3d-model" && (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-wider">3D Model Path (.glb)</label>
                                        <input
                                            type="text"
                                            value={modalValue}
                                            onChange={(e) => setModalValue(e.target.value)}
                                            className="w-full bg-white border-[3px] border-black rounded-md px-3 py-2 text-xs outline-none focus:shadow-[2px_2px_0px_var(--ocms-orange)] font-mono font-bold"
                                            placeholder="/models/..."
                                        />
                                    </div>

                                    {/* Presets Grid */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-wider block">Material Presets</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {PBR_PRESETS.map((preset) => (
                                                <button
                                                    key={preset.name}
                                                    type="button"
                                                    onClick={() => {
                                                        setModalRoughness(preset.roughness);
                                                        setModalMetalness(preset.metalness);
                                                        setModalTextureUrl(preset.textureUrl);
                                                    }}
                                                    className="flex items-center gap-2 p-2 border-[2.5px] border-black rounded-md bg-white hover:bg-slate-50 active:translate-x-[1px] active:translate-y-[1px] shadow-[2px_2px_0px_#000] active:shadow-none transition-all text-left"
                                                >
                                                    <span
                                                        className="w-4 h-4 rounded-full border border-black shrink-0"
                                                        style={{
                                                            backgroundColor: preset.previewColor,
                                                            backgroundImage: `url("${preset.textureUrl}")`,
                                                            backgroundSize: 'cover'
                                                        }}
                                                    />
                                                    <span className="text-[9px] font-black uppercase tracking-tight">{preset.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Sliders */}
                                    <div className="grid grid-cols-2 gap-3 pt-1">
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                                <span>Roughness</span>
                                                <span className="bg-[var(--ocms-yellow)] px-1 border border-black rounded-[2px]">{modalRoughness.toFixed(2)}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.05"
                                                value={modalRoughness}
                                                onChange={(e) => setModalRoughness(parseFloat(e.target.value))}
                                                className="w-full h-2 bg-white border-2 border-black rounded-full accent-black cursor-pointer"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                                <span>Metalness</span>
                                                <span className="bg-[var(--ocms-blue)] text-black px-1 border border-black rounded-[2px]">{modalMetalness.toFixed(2)}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.05"
                                                value={modalMetalness}
                                                onChange={(e) => setModalMetalness(parseFloat(e.target.value))}
                                                className="w-full h-2 bg-white border-2 border-black rounded-full accent-black cursor-pointer"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-wider">Texture URL (Optional Override)</label>
                                        <input
                                            type="text"
                                            value={modalTextureUrl}
                                            onChange={(e) => setModalTextureUrl(e.target.value)}
                                            className="w-full bg-white border-[3px] border-black rounded-md px-3 py-2 text-[9px] outline-none focus:shadow-[2px_2px_0px_var(--ocms-orange)] font-mono font-bold"
                                            placeholder="data:image/svg+xml;..."
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t-2 border-black">
                            <button
                                type="button"
                                onClick={() => setEditingField(null)}
                                className="px-4 py-2 border-[3px] border-black rounded-md bg-white font-black text-xs uppercase shadow-[3px_3px_0px_#000] hover:bg-slate-100 transition-all hover:translate-x-[-1px] hover:translate-y-[-1px]"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveModal}
                                className="px-4 py-2 border-[3px] border-black rounded-md bg-[var(--ocms-yellow)] font-black text-xs uppercase shadow-[3px_3px_0px_#000] hover:bg-[var(--ocms-orange)] hover:text-white transition-all hover:translate-x-[-1px] hover:translate-y-[-1px]"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
