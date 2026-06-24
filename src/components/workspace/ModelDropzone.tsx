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
            className={`relative rounded-md border-[3px] border-dashed p-5 text-center cursor-pointer transition-all duration-300 ${
                state === "dragging"
                    ? "border-black bg-[var(--ocms-green-glow)] shadow-[3px_3px_0px_#000] -translate-x-[2px] -translate-y-[2px]"
                    : state === "done"
                        ? "border-black border-solid bg-emerald-50 shadow-[3px_3px_0px_#000]"
                        : state === "error"
                            ? "border-black border-solid bg-red-50"
                            : "border-black bg-[#fcfbf9] hover:bg-[var(--ocms-orange-glow)] hover:shadow-[3px_3px_0px_#000] hover:-translate-x-[2px] hover:-translate-y-[2px]"
            }`}
        >
            <input
                type="file"
                accept=".glb,.gltf"
                aria-label="Drop GLB or GLTF to inject 3D model"
                onChange={handleInputChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            {state === "uploading" ? (
                <div className="flex flex-col items-center gap-2 py-2">
                    <Loader2 className="w-6 h-6 text-black animate-spin" />
                    <span className="text-xs text-black font-mono font-bold">Uploading {fileName}...</span>
                </div>
            ) : state === "done" ? (
                <div className="flex flex-col items-center gap-2 py-2">
                    <CheckCircle className="w-6 h-6 text-emerald-700" />
                    <span className="text-xs text-emerald-800 font-black uppercase tracking-wider">3D Model Injected!</span>
                </div>
            ) : state === "error" ? (
                <div className="flex flex-col items-center gap-2 py-2">
                    <span className="text-xs text-red-700 font-bold">{errorMsg}</span>
                    <button
                        onClick={() => setState("idle")}
                        className="text-[10px] text-black font-black uppercase underline hover:text-[var(--ocms-orange)]"
                    >
                        Try again
                    </button>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-2.5 py-1">
                    <div className="p-2 rounded-md bg-white border-2 border-black shadow-[2px_2px_0px_#000]">
                        {state === "dragging" ? (
                            <Upload className="w-5 h-5 text-black" />
                        ) : (
                            <Box className="w-5 h-5 text-black" />
                        )}
                    </div>
                    <span className="text-[10px] text-black font-extrabold uppercase tracking-wide">
                        Drop <strong>.glb</strong> / <strong>.gltf</strong> to inject 3D model
                    </span>
                </div>
            )}
        </div>
    );
}
