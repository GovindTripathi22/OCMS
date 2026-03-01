"use client";

import { useCallback, useState } from "react";
import { Box, Upload, Loader2, CheckCircle } from "lucide-react";

interface ModelDropzoneProps {
    projectId: string;
    targetFieldId: string;
    onModelInjected: (targetFieldId: string, modelPath: string) => void;
}

type UploadState = "idle" | "dragging" | "uploading" | "done" | "error";

export default function ModelDropzone({
    projectId,
    targetFieldId,
    onModelInjected,
}: ModelDropzoneProps) {
    const [state, setState] = useState<UploadState>("idle");
    const [fileName, setFileName] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    const MAX_SIZE_MB = 50;

    const handleFile = useCallback(
        async (file: File) => {
            const ext = file.name.split(".").pop()?.toLowerCase();
            if (ext !== "glb" && ext !== "gltf") {
                setState("error");
                setErrorMsg("Only .glb and .gltf files are accepted.");
                return;
            }

            if (file.size > MAX_SIZE_MB * 1024 * 1024) {
                setState("error");
                setErrorMsg(`File exceeds ${MAX_SIZE_MB}MB limit.`);
                return;
            }

            setState("uploading");
            setFileName(file.name);

            try {
                const formData = new FormData();
                formData.append("model", file);
                formData.append("projectId", projectId);

                const res = await fetch("/api/upload-model", {
                    method: "POST",
                    body: formData,
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || "Upload failed");
                }

                const { path } = await res.json();
                setState("done");
                onModelInjected(targetFieldId, path);
            } catch (err) {
                setState("error");
                setErrorMsg(err instanceof Error ? err.message : "Upload failed");
            }
        },
        [projectId, targetFieldId, onModelInjected]
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setState("idle");
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
        },
        [handleFile]
    );

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
        },
        [handleFile]
    );

    return (
        <div
            onDragOver={(e) => {
                e.preventDefault();
                setState("dragging");
            }}
            onDragLeave={() => setState("idle")}
            onDrop={handleDrop}
            className={`relative rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-all duration-200 ${state === "dragging"
                    ? "border-[var(--ocms-accent)] bg-[var(--ocms-accent)]/5"
                    : state === "done"
                        ? "border-emerald-500/50 bg-emerald-500/5"
                        : state === "error"
                            ? "border-red-500/50 bg-red-500/5"
                            : "border-[var(--ocms-border)] hover:border-slate-500"
                }`}
        >
            <input
                type="file"
                accept=".glb,.gltf"
                onChange={handleInputChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            {state === "uploading" ? (
                <div className="flex flex-col items-center gap-2 py-2">
                    <Loader2 className="w-6 h-6 text-[var(--ocms-accent)] animate-spin" />
                    <span className="text-xs text-slate-400">Uploading {fileName}...</span>
                </div>
            ) : state === "done" ? (
                <div className="flex flex-col items-center gap-2 py-2">
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                    <span className="text-xs text-emerald-400">3D Model Injected!</span>
                </div>
            ) : state === "error" ? (
                <div className="flex flex-col items-center gap-2 py-2">
                    <span className="text-xs text-red-400">{errorMsg}</span>
                    <button
                        onClick={() => setState("idle")}
                        className="text-[10px] text-slate-500 underline"
                    >
                        Try again
                    </button>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-2 py-2">
                    <div className="p-2 rounded-lg bg-white/5">
                        {state === "dragging" ? (
                            <Upload className="w-5 h-5 text-[var(--ocms-accent)]" />
                        ) : (
                            <Box className="w-5 h-5 text-slate-500" />
                        )}
                    </div>
                    <span className="text-xs text-slate-500">
                        Drop <strong>.glb</strong> / <strong>.gltf</strong> to inject 3D model
                    </span>
                </div>
            )}
        </div>
    );
}
