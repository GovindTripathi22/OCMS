"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import ContentEditor from "@/components/workspace/ContentEditor";
import LivePreview from "@/components/workspace/LivePreview";
import PermissionWizard from "@/components/workspace/PermissionWizard";
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

interface ModalState {
    field: SchemaField;
    value: string;
    alt: string;
    objectFit: string;
    borderRadius: string;
    roughness: number;
    metalness: number;
    textureUrl: string;
}

export default function WorkspaceClient({ project, initialSchema }: WorkspaceClientProps) {
    const [schema, setSchema] = useState<SchemaField[]>(initialSchema);
    const [history, setHistory] = useState<SchemaField[][]>([initialSchema]);

    const [previewUrl, setPreviewUrl] = useState(project.sourceUrl);
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    // GitHub Repo configuration state
    const [githubOwner, setGithubOwner] = useState(project.githubOwner);
    const [githubRepo, setGithubRepo] = useState(project.githubRepo);
    const [targetFilePath, setTargetFilePath] = useState(project.targetFilePath);
    const [showPermissionWizard, setShowPermissionWizard] = useState(false);

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const inlineEditRef = useRef(false);

    // Consolidated modal state
    const [modalState, setModalState] = useState<ModalState | null>(null);

    // Toast notification state
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
        setToast({ message, type });
    }, []);

    // Dismiss toast automatically
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => {
            setToast(null);
        }, 4000);
        return () => clearTimeout(timer);
    }, [toast]);

    // Refs for performance optimizations
    const historyIndexRef = useRef(0);
    const isDirtyRef = useRef(false);

    // Shared postMessage payload builder
    const buildChangesPayload = useCallback((fields: SchemaField[]) => {
        return fields
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
    }, []);

    const pushHistory = useCallback((next: SchemaField[]) => {
        setHistory((currentHistory) => {
            const idx = historyIndexRef.current;
            const updated = [
                ...currentHistory.slice(0, idx + 1),
                next,
            ];
            historyIndexRef.current = updated.length - 1;

            return updated;
        });
        isDirtyRef.current = true;
    }, []);

    const handleFieldUpdate = useCallback((fieldId: string, updates: Partial<SchemaField>) => {
        setSchema((prev) => {
            const currentField = prev.find((f) => f.id === fieldId);
            if (!currentField) return prev;

            const next = prev.map((f) => (f.id === fieldId ? { ...f, ...updates } : f));
            pushHistory(next);
            return next;
        });
    }, [pushHistory]);

    const handleSaveModal = () => {
        if (!modalState) return;
        
        const updates: Partial<SchemaField> = {
            value: modalState.value,
            alt: modalState.alt,
            objectFit: modalState.objectFit,
            borderRadius: modalState.borderRadius,
            roughness: modalState.roughness,
            metalness: modalState.metalness,
            textureUrl: modalState.textureUrl,
        };
        
        setSchema((prev) => {
            const next = prev.map((f) => (f.id === modalState.field.id ? { ...f, ...updates } : f));
            pushHistory(next);
            return next;
        });
        
        setModalState(null);
    };

    const handleScanPage = useCallback(async () => {
        const iframe = iframeRef.current;
        if (!iframe?.contentDocument) {
            showToast("Preview is not loaded yet.", "error");
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
                const idx = historyIndexRef.current;
                setHistory((prev) => {
                    const updated = [...prev.slice(0, idx + 1), data.schema];
                    historyIndexRef.current = updated.length - 1;

                    return updated;
                });
                isDirtyRef.current = true;
                showToast("Page content scanned successfully!");
            }
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : "Failed to scan page";
            showToast(errMsg, "error");
        } finally {
            setIsScanning(false);
        }
    }, [project.id, previewUrl, showToast]);

    const handleFieldChange = useCallback((fieldId: string, newValue: string) => {
        setSchema((prev) => {
            const currentField = prev.find((f) => f.id === fieldId);
            if (!currentField || currentField.value === newValue) return prev;

            const next = prev.map((f) => (f.id === fieldId ? { ...f, value: newValue } : f));
            if (!inlineEditRef.current) pushHistory(next);
            else isDirtyRef.current = true;
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

        const changesPayload = buildChangesPayload(schema);

        iframe.contentWindow.postMessage(
            { source: "ocms-live-bridge", changes: changesPayload },
            window.location.origin
        );
    }, [schema, iframeLoaded, buildChangesPayload]);

    // Debounced autosave effect for persisting schema edits to database
    useEffect(() => {
        if (!isDirtyRef.current) return;

        const timer = setTimeout(async () => {
            try {
                const response = await fetch(`/api/projects/${project.id}/schema`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ schema }),
                });
                if (response.ok) {
                    isDirtyRef.current = false;
                } else {
                    console.error("[Autosave] Failed to update project schema");
                }
            } catch (err) {
                console.error("[Autosave] Network error updating schema:", err);
            }
        }, 1500);

        return () => clearTimeout(timer);
    }, [schema, project.id]);

    const broadcastGhostEvent = useCallback((type: "AI_EDIT_START" | "AI_EDIT_END", selector?: string, text?: string) => {
        const iframe = iframeRef.current;
        if (!iframe?.contentWindow || !iframeLoaded) return;

        iframe.contentWindow.postMessage(
            { source: "ocms-editor", type, selector, text },
            window.location.origin
        );
    }, [iframeLoaded]);

    useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            // Lock origin checks to same origin to prevent external origins spoofing messages
            if (event.origin !== window.location.origin) return;
            if (event.source !== iframeRef.current?.contentWindow) return;
            const { source, fieldId, newValue, file, action, value } = event.data;

            try {
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

                    const changesPayload = buildChangesPayload(schema);
                    iframeRef.current?.contentWindow?.postMessage(
                        { source: "ocms-live-bridge", changes: changesPayload },
                        window.location.origin
                    );
                    return;
                }

                if (source === "ocms-inline-edit") {
                    inlineEditRef.current = true;
                    handleFieldChange(fieldId, newValue);
                    inlineEditRef.current = false;
                    setHistory((currentHistory) => {
                        const idx = historyIndexRef.current;
                        const base = currentHistory[idx] ?? schema;
                        const next = base.map((f) => (f.id === fieldId ? { ...f, value: newValue } : f));
                        const updated = [...currentHistory.slice(0, idx + 1), next];
                        historyIndexRef.current = updated.length - 1;

                        return updated;
                    });
                }

                if (source === "ocms-inline-add-field" && event.data.field) {
                    const newField = event.data.field;
                    setSchema((prev) => {
                        if (prev.some((f) => f.id === newField.id || (f.selector === newField.selector && f.type === newField.type))) {
                            return prev;
                        }
                        const next = [...prev, newField];
                        setHistory((currentHistory) => {
                            const idx = historyIndexRef.current;
                            const updated = [...currentHistory.slice(0, idx + 1), next];
                            historyIndexRef.current = updated.length - 1;

                            return updated;
                        });
                        return next;
                    });
                }

                if (source === "ocms-doubleclick-image" && event.data.field) {
                    const field = event.data.field;
                    setModalState({
                        field,
                        value: field.value || "",
                        alt: field.alt || "",
                        objectFit: field.objectFit || "cover",
                        borderRadius: field.borderRadius || "none",
                        roughness: field.roughness !== undefined ? field.roughness : 0.5,
                        metalness: field.metalness !== undefined ? field.metalness : 1.0,
                        textureUrl: field.textureUrl || "",
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

                    if (!response.ok) {
                        const errData = await response.json().catch(() => ({}));
                        throw new Error(errData.error || `Upload failed with status ${response.status}`);
                    }
                    const asset = await response.json();
                    handleModelInjected(targetFieldId, asset.path || asset.urlHighPoly);
                    showToast("3D model uploaded successfully!");
                }

                if (source === "ocms-toolbar-action" && fieldId && value) {
                    const response = await fetch("/api/inline-text-action", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action, value }),
                    });

                    if (!response.ok) {
                        const errData = await response.json().catch(() => ({}));
                        throw new Error(errData.error || `Text formatting failed with status ${response.status}`);
                    }
                    const data = await response.json();
                    if (data.value) {
                        handleFieldChange(fieldId, data.value);
                        showToast(`Text formatting action '${action}' completed!`);
                    }
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                showToast(msg, "error");
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [handleFieldChange, handleModelInjected, project.id, schema, previewUrl, buildChangesPayload, showToast]);

    const handleSchemaReplace = useCallback((newSchema: SchemaField[]) => {
        setSchema(newSchema);
        pushHistory(newSchema);
    }, [pushHistory]);

    const seekHistory = useCallback((percent: number) => {
        const index = Math.floor((percent / 100) * (history.length - 1));
        historyIndexRef.current = index;

        setSchema(history[index]);
    }, [history]);

    return (
        <div className="fixed inset-0 pt-16 flex flex-col bg-[var(--ocms-bg)] overflow-hidden">
            <div className="flex-1 flex flex-col lg:flex-row gap-3 p-3 lg:p-4 lg:gap-4 min-h-0">
                {/* ─── Sidebar Editor Panel ─── */}
                <div className="w-full lg:w-[340px] xl:w-[380px] h-[45vh] lg:h-full min-h-0 border-[3px] border-black lg:rounded-md lg:shadow-[5px_5px_0px_#000] bg-white flex flex-col transition-all duration-300 hover:shadow-[6px_6px_0px_var(--ocms-orange)] hover:translate-x-[-2px] hover:translate-y-[-2px]">
                    <ContentEditor
                        projectId={project.id}
                        schema={schema}
                        initialSchema={initialSchema}
                        onFieldChange={handleFieldChange}
                        onFieldUpdate={handleFieldUpdate}
                        onModelInjected={handleModelInjected}
                        githubOwner={githubOwner}
                        githubRepo={githubRepo}
                        targetFilePath={targetFilePath}
                        onHistorySeek={seekHistory}
                        historyCount={history.length}
                        onSchemaReplace={handleSchemaReplace}
                        broadcastGhostEvent={broadcastGhostEvent}
                        previewUrl={previewUrl}
                        isScanning={isScanning}
                        onScanPage={handleScanPage}
                        openPermissionWizard={() => setShowPermissionWizard(true)}
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
            {modalState && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-[#fcfbf9] border-[4px] border-black rounded-xl shadow-[8px_8px_0px_#000] p-6 text-black relative animate-fade-in">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-4 border-b-2 border-black mb-4">
                            <h3 className="text-base font-black uppercase tracking-tight">
                                ⚙️ {modalState.field.type === "3d-model" ? "3D Model Options" : "Image Options"}
                            </h3>
                            <button
                                onClick={() => setModalState(null)}
                                className="w-8 h-8 flex items-center justify-center border-2 border-black rounded-md bg-white hover:bg-[var(--ocms-orange)] hover:text-white transition-all shadow-[2px_2px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px]"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body */}
                        <div className="space-y-4">
                            {/* Type Specific Fields */}
                            {modalState.field.type === "image" && (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-wider">Image Source URL</label>
                                        <input
                                            type="text"
                                            value={modalState.value}
                                            onChange={(e) => setModalState(prev => prev ? { ...prev, value: e.target.value } : null)}
                                            className="w-full bg-white border-[3px] border-black rounded-md px-3 py-2 text-xs outline-none focus:shadow-[2px_2px_0px_var(--ocms-cyan)] font-mono font-bold"
                                            placeholder="https://..."
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-wider">Alt Text (SEO)</label>
                                        <input
                                            type="text"
                                            value={modalState.alt}
                                            onChange={(e) => setModalState(prev => prev ? { ...prev, alt: e.target.value } : null)}
                                            className="w-full bg-white border-[3px] border-black rounded-md px-3 py-2 text-xs outline-none focus:shadow-[2px_2px_0px_var(--ocms-cyan)] font-bold"
                                            placeholder="Image description..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase tracking-wider">Object Fit</label>
                                            <select
                                                value={modalState.objectFit}
                                                onChange={(e) => setModalState(prev => prev ? { ...prev, objectFit: e.target.value } : null)}
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
                                                value={modalState.borderRadius}
                                                onChange={(e) => setModalState(prev => prev ? { ...prev, borderRadius: e.target.value } : null)}
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

                            {modalState.field.type === "3d-model" && (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-wider">3D Model Path (.glb)</label>
                                        <input
                                            type="text"
                                            value={modalState.value}
                                            onChange={(e) => setModalState(prev => prev ? { ...prev, value: e.target.value } : null)}
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
                                                        setModalState(prev => prev ? {
                                                            ...prev,
                                                            roughness: preset.roughness,
                                                            metalness: preset.metalness,
                                                            textureUrl: preset.textureUrl
                                                        } : null);
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
                                                <span className="bg-[var(--ocms-yellow)] px-1 border border-black rounded-[2px]">{modalState.roughness.toFixed(2)}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.05"
                                                value={modalState.roughness}
                                                onChange={(e) => setModalState(prev => prev ? { ...prev, roughness: parseFloat(e.target.value) } : null)}
                                                className="w-full h-2 bg-white border-2 border-black rounded-full accent-black cursor-pointer"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                                <span>Metalness</span>
                                                <span className="bg-[var(--ocms-blue)] text-black px-1 border border-black rounded-[2px]">{modalState.metalness.toFixed(2)}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.05"
                                                value={modalState.metalness}
                                                onChange={(e) => setModalState(prev => prev ? { ...prev, metalness: parseFloat(e.target.value) } : null)}
                                                className="w-full h-2 bg-white border-2 border-black rounded-full accent-black cursor-pointer"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-wider">Texture URL (Optional Override)</label>
                                        <input
                                            type="text"
                                            value={modalState.textureUrl}
                                            onChange={(e) => setModalState(prev => prev ? { ...prev, textureUrl: e.target.value } : null)}
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
                                onClick={() => setModalState(null)}
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

            {/* Custom Neobrutalist Toast Notification */}
            {toast && (
                <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
                    <div className={`px-4 py-3 border-[3px] border-black rounded-md shadow-[4px_4px_0px_#000] font-black text-xs uppercase flex items-center gap-3 ${
                        toast.type === "error" ? "bg-[var(--ocms-rose)] text-black" : "bg-[var(--ocms-green)] text-black"
                    }`}>
                        <span>{toast.type === "error" ? "⚠️" : "⚡"}</span>
                        <span>{toast.message}</span>
                        <button onClick={() => setToast(null)} className="ml-2 font-bold hover:opacity-75">✕</button>
                    </div>
                </div>
            )}

            {showPermissionWizard && (
                <PermissionWizard
                    projectId={project.id}
                    currentOwner={githubOwner}
                    currentRepo={githubRepo}
                    currentFilePath={targetFilePath}
                    onClose={() => setShowPermissionWizard(false)}
                    onSetupCompleted={(data) => {
                        setGithubOwner(data.githubOwner);
                        setGithubRepo(data.githubRepo);
                        setTargetFilePath(data.targetFilePath);
                    }}
                />
            )}
        </div>
    );
}
