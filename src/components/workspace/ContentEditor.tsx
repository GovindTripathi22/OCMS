"use client";

import { useState } from "react";
import { Type, ImageIcon, Link2, Box, Loader2, Check, AlertCircle } from "lucide-react";
import dynamic from "next/dynamic";
import ModelDropzone from "./ModelDropzone";
import type { SchemaField } from "@/app/workspace/[projectId]/page";

const ModelViewer = dynamic(() => import("./ModelViewer"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center bg-slate-900 rounded-lg">
            <div className="w-6 h-6 border-2 border-[var(--ocms-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
    ),
});

interface ContentEditorProps {
    projectId: string;
    schema: SchemaField[];
    onFieldChange: (fieldId: string, newValue: string) => void;
    onModelInjected: (targetFieldId: string, modelPath: string) => void;
}

const fieldIcons: Record<SchemaField["type"], React.ReactNode> = {
    text: <Type className="w-4 h-4" />,
    image: <ImageIcon className="w-4 h-4" />,
    link: <Link2 className="w-4 h-4" />,
    "3d-model": <Box className="w-4 h-4" />,
};

type SyncStatus = "idle" | "syncing" | "success" | "error";

export default function ContentEditor({
    projectId,
    schema,
    onFieldChange,
    onModelInjected,
}: ContentEditorProps) {
    const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
    const [errorMessage, setErrorMessage] = useState("");

    const handleSaveAndSync = async () => {
        setSyncStatus("syncing");
        setErrorMessage("");

        // Build the changes array from the current schema
        const changes = schema
            .filter((f) => f.type !== "3d-model")
            .map((f) => ({ fieldId: f.id, newValue: f.value }));

        try {
            const res = await fetch("/api/publish-changes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    repoOwner: "GovindTripathi22",  // TODO: Pull from project config
                    repoName: "OCMS",               // TODO: Pull from project config
                    filePath: "src/app/page.tsx",    // TODO: Pull from project config
                    changes,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Unknown error occurred");
            }

            setSyncStatus("success");
            // Reset to idle after 3 seconds
            setTimeout(() => setSyncStatus("idle"), 3000);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to sync";
            setErrorMessage(message);
            setSyncStatus("error");
            setTimeout(() => setSyncStatus("idle"), 5000);
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-5 border-b border-[var(--ocms-border)]">
                <h2 className="text-lg font-bold text-white tracking-tight">Content Editor</h2>
                <p className="text-xs text-slate-500 mt-1">
                    Edit fields below to update the live preview.
                </p>
            </div>

            {/* Schema Fields */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {schema.map((field) => (
                    <div
                        key={field.id}
                        className="group rounded-xl border border-[var(--ocms-border)] bg-white/[0.02] backdrop-blur-sm p-4 transition-all duration-200 hover:border-[var(--ocms-accent)]/30 hover:bg-white/[0.04]"
                    >
                        {/* Field Label */}
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-[var(--ocms-accent)]">
                                {fieldIcons[field.type]}
                            </span>
                            <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                                {field.label}
                            </label>
                            <span className="ml-auto text-[10px] font-mono text-slate-600 bg-white/5 px-2 py-0.5 rounded-full">
                                {field.type}
                            </span>
                        </div>

                        {/* Field Input */}
                        {field.type === "3d-model" ? (
                            <div className="rounded-lg overflow-hidden border border-[var(--ocms-border)] h-48">
                                <ModelViewer modelPath={field.value} />
                            </div>
                        ) : field.type === "image" ? (
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={field.value}
                                    onChange={(e) => onFieldChange(field.id, e.target.value)}
                                    className="w-full bg-white/[0.03] border border-[var(--ocms-border)] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-[var(--ocms-accent)] focus:ring-1 focus:ring-[var(--ocms-accent)]/30 transition-all"
                                    placeholder="Image URL..."
                                />
                                <ModelDropzone
                                    projectId={projectId}
                                    targetFieldId={field.id}
                                    onModelInjected={onModelInjected}
                                />
                            </div>
                        ) : (
                            <input
                                type="text"
                                value={field.value}
                                onChange={(e) => onFieldChange(field.id, e.target.value)}
                                className="w-full bg-white/[0.03] border border-[var(--ocms-border)] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-[var(--ocms-accent)] focus:ring-1 focus:ring-[var(--ocms-accent)]/30 transition-all"
                                placeholder={`Enter ${field.label.toLowerCase()}...`}
                            />
                        )}
                    </div>
                ))}
            </div>

            {/* Footer Action — Wired Save & Sync */}
            <div className="p-5 border-t border-[var(--ocms-border)]">
                {syncStatus === "error" && errorMessage && (
                    <div className="mb-3 flex items-center gap-2 text-xs text-red-400 font-mono bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span className="truncate">{errorMessage}</span>
                    </div>
                )}
                <button
                    onClick={handleSaveAndSync}
                    disabled={syncStatus === "syncing"}
                    className={`boxy-btn w-full py-3 text-sm transition-all duration-200 ${syncStatus === "success"
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : syncStatus === "error"
                            ? "bg-red-500/20 text-red-400 border-red-500/50"
                            : "bg-[var(--ocms-accent)] text-white border-[var(--ocms-accent)] hover:bg-[var(--ocms-accent)]/90"
                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                    {syncStatus === "syncing" ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>AI is modifying code...</span>
                        </>
                    ) : syncStatus === "success" ? (
                        <>
                            <Check className="w-4 h-4" />
                            <span>Pushed to GitHub!</span>
                        </>
                    ) : syncStatus === "error" ? (
                        <>
                            <AlertCircle className="w-4 h-4" />
                            <span>Sync Failed — Retry</span>
                        </>
                    ) : (
                        <span>Save & Sync to GitHub</span>
                    )}
                </button>
            </div>
        </div>
    );
}
