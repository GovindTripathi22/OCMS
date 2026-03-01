"use client";

import { useState, useRef } from "react";
import {
    Type, ImageIcon, Link2, Box, Loader2, Check, AlertCircle,
    Mic, MicOff, Palette, Code2, Clock, Gauge, Sparkles,
    MousePointer2, Copy, Wand2, ChevronDown, ChevronRight,
    GitBranch, Zap, Eye
} from "lucide-react";
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
    text: <Type className="w-3.5 h-3.5" />,
    image: <ImageIcon className="w-3.5 h-3.5" />,
    link: <Link2 className="w-3.5 h-3.5" />,
    "3d-model": <Box className="w-3.5 h-3.5" />,
};

type SyncStatus = "idle" | "syncing" | "success" | "error";

/* ─── Collapsible Feature Panel ─── */
function FeaturePanel({ icon, title, tag, children, defaultOpen = false }: {
    icon: React.ReactNode; title: string; tag?: string;
    children: React.ReactNode; defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-white/[0.06] rounded-lg overflow-hidden bg-white/[0.015] backdrop-blur-sm">
            <button onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-white/[0.03] transition-colors">
                <span className="text-[var(--ocms-accent)]">{icon}</span>
                <span className="text-xs font-semibold text-slate-200 tracking-wide flex-1">{title}</span>
                {tag && <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">{tag}</span>}
                {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
            </button>
            {open && <div className="px-3.5 pb-3.5 pt-1 border-t border-white/[0.04]">{children}</div>}
        </div>
    );
}

export default function ContentEditor({
    projectId,
    schema,
    onFieldChange,
    onModelInjected,
}: ContentEditorProps) {
    const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
    const [errorMessage, setErrorMessage] = useState("");
    const [isListening, setIsListening] = useState(false);
    const [voiceText, setVoiceText] = useState("");
    const [showCode, setShowCode] = useState(false);
    const [timelinePos, setTimelinePos] = useState(100);
    const [lighthouseScore] = useState(92);
    const [componentUrl, setComponentUrl] = useState("");
    const [abTarget, setAbTarget] = useState("gen-z");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSaveAndSync = async () => {
        setSyncStatus("syncing");
        setErrorMessage("");
        const changes = schema
            .filter((f) => f.type !== "3d-model")
            .map((f) => ({ fieldId: f.id, newValue: f.value }));
        try {
            const res = await fetch("/api/publish-changes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    repoOwner: "GovindTripathi22",
                    repoName: "OCMS",
                    filePath: "src/app/page.tsx",
                    changes,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Unknown error");
            setSyncStatus("success");
            setTimeout(() => setSyncStatus("idle"), 3000);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to sync";
            setErrorMessage(message);
            setSyncStatus("error");
            setTimeout(() => setSyncStatus("idle"), 5000);
        }
    };

    const toggleVoice = () => {
        if (isListening) {
            setIsListening(false);
            setVoiceText("");
        } else {
            setIsListening(true);
            setVoiceText("Listening...");
            // Simulated voice recognition for demo
            setTimeout(() => {
                setVoiceText("\"Make the hero title bolder\"");
                setTimeout(() => { setIsListening(false); setVoiceText(""); }, 3000);
            }, 2000);
        }
    };

    return (
        <div className="flex flex-col h-full font-[family-name:var(--font-space-grotesk)]">
            {/* ─── Header ─── */}
            <div className="px-4 py-3.5 border-b border-white/[0.08] bg-white/[0.02]">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[var(--ocms-accent)] animate-pulse" />
                    <h2 className="text-sm font-bold text-white tracking-tight">OCMS Editor</h2>
                    <span className="ml-auto text-[9px] font-bold uppercase text-slate-500 tracking-widest font-[family-name:var(--font-jetbrains-mono)]">
                        v2.0
                    </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5 font-[family-name:var(--font-jetbrains-mono)]">
                    Project: {projectId.slice(0, 12)}...
                </p>
            </div>

            {/* ─── Scrollable Content ─── */}
            <div className="flex-1 overflow-y-auto px-3.5 py-3.5 space-y-2.5">

                {/* ════ SCHEMA FIELDS ════ */}
                <FeaturePanel icon={<Type className="w-3.5 h-3.5" />} title="Content Fields" tag="Live" defaultOpen>
                    <div className="space-y-2.5 mt-1">
                        {schema.map((field) => (
                            <div key={field.id} className="group">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <span className="text-[var(--ocms-accent)] opacity-60">{fieldIcons[field.type]}</span>
                                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                                        {field.label}
                                    </label>
                                    <span className="ml-auto text-[9px] font-[family-name:var(--font-jetbrains-mono)] text-slate-600 bg-white/[0.04] px-1.5 py-0.5 rounded">
                                        {field.type}
                                    </span>
                                </div>
                                {field.type === "3d-model" ? (
                                    <div className="rounded-lg overflow-hidden border border-white/[0.08] h-40">
                                        <ModelViewer modelPath={field.value} />
                                    </div>
                                ) : field.type === "image" ? (
                                    <div className="space-y-2">
                                        <input type="text" value={field.value}
                                            onChange={(e) => onFieldChange(field.id, e.target.value)}
                                            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-md px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-[var(--ocms-accent)] focus:ring-1 focus:ring-[var(--ocms-accent)]/20 transition-all font-[family-name:var(--font-jetbrains-mono)]"
                                            placeholder="Image URL..." />
                                        <ModelDropzone projectId={projectId} targetFieldId={field.id} onModelInjected={onModelInjected} />
                                    </div>
                                ) : (
                                    <input type="text" value={field.value}
                                        onChange={(e) => onFieldChange(field.id, e.target.value)}
                                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-md px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-[var(--ocms-accent)] focus:ring-1 focus:ring-[var(--ocms-accent)]/20 transition-all font-[family-name:var(--font-jetbrains-mono)]"
                                        placeholder={`Enter ${field.label.toLowerCase()}...`} />
                                )}
                            </div>
                        ))}
                    </div>
                </FeaturePanel>

                {/* ════ 1. 3D MODEL INJECTOR ════ */}
                <FeaturePanel icon={<Box className="w-3.5 h-3.5" />} title="3D Model Injector" tag="New">
                    <p className="text-[10px] text-slate-500 mb-2">Drag & drop .gltf or .spline files to inject a Three.js canvas into the live code.</p>
                    <div className="border-2 border-dashed border-white/[0.12] rounded-lg px-4 py-6 text-center cursor-pointer hover:border-[var(--ocms-accent)]/40 transition-colors"
                        onClick={() => fileInputRef.current?.click()}>
                        <Box className="w-6 h-6 text-slate-500 mx-auto mb-2" />
                        <p className="text-[10px] text-slate-400">Drop 3D model here or click to browse</p>
                        <p className="text-[9px] text-slate-600 mt-1">.gltf, .glb, .spline</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept=".gltf,.glb,.spline" className="hidden" />
                </FeaturePanel>

                {/* ════ 2. TIME TRAVEL PREVIEW ════ */}
                <FeaturePanel icon={<Clock className="w-3.5 h-3.5" />} title="Time Travel Preview" tag="New">
                    <p className="text-[10px] text-slate-500 mb-2">Scrub through your edit history and watch the preview rewind.</p>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] text-slate-600 font-[family-name:var(--font-jetbrains-mono)]">0:00</span>
                        <input type="range" min={0} max={100} value={timelinePos}
                            onChange={(e) => setTimelinePos(Number(e.target.value))}
                            className="flex-1 h-1 bg-white/[0.06] rounded-full accent-[var(--ocms-accent)] cursor-pointer" />
                        <span className="text-[9px] text-slate-600 font-[family-name:var(--font-jetbrains-mono)]">NOW</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-[9px] text-slate-500">{timelinePos}% of session</span>
                        <span className="text-[9px] text-emerald-400 font-[family-name:var(--font-jetbrains-mono)]">4 edits</span>
                    </div>
                </FeaturePanel>

                {/* ════ 3. AI COLOR PALETTE EXTRACTOR ════ */}
                <FeaturePanel icon={<Palette className="w-3.5 h-3.5" />} title="AI Color Extractor" tag="AI">
                    <p className="text-[10px] text-slate-500 mb-2">Upload a logo or image. AI rewrites your CSS variables to match the brand.</p>
                    <button className="w-full text-xs bg-white/[0.04] border border-white/[0.08] rounded-md py-2 text-slate-300 hover:bg-white/[0.06] hover:border-[var(--ocms-accent)]/30 transition-all flex items-center justify-center gap-1.5">
                        <Palette className="w-3 h-3" /> Upload Brand Asset
                    </button>
                    <div className="flex gap-1.5 mt-2.5">
                        {["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"].map((c) => (
                            <div key={c} className="w-6 h-6 rounded border border-white/[0.1] cursor-pointer hover:scale-110 transition-transform" style={{ background: c }} />
                        ))}
                        <span className="text-[9px] text-slate-600 self-center ml-1">Current</span>
                    </div>
                </FeaturePanel>

                {/* ════ 4. GHOST CO-PILOT CURSOR ════ */}
                <FeaturePanel icon={<MousePointer2 className="w-3.5 h-3.5" />} title="Ghost Co-Pilot" tag="AI">
                    <p className="text-[10px] text-slate-500 mb-2">When AI edits code, a ghost cursor appears in the live preview showing what it touches.</p>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] text-emerald-400 font-[family-name:var(--font-jetbrains-mono)]">Ghost mode: Active</span>
                        <label className="ml-auto relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" defaultChecked className="sr-only peer" />
                            <div className="w-7 h-4 bg-white/[0.1] peer-checked:bg-[var(--ocms-accent)] rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3" />
                        </label>
                    </div>
                </FeaturePanel>

                {/* ════ 5. AUTO A/B TESTING SPAWNER ════ */}
                <FeaturePanel icon={<Copy className="w-3.5 h-3.5" />} title="A/B Variant Spawner" tag="AI">
                    <p className="text-[10px] text-slate-500 mb-2">Generate alternate copy for a different audience and push both to GitHub.</p>
                    <select value={abTarget} onChange={(e) => setAbTarget(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-md px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-[var(--ocms-accent)] mb-2 font-[family-name:var(--font-jetbrains-mono)]">
                        <option value="gen-z">Gen Z Audience</option>
                        <option value="corporate">Corporate / B2B</option>
                        <option value="casual">Casual / Friendly</option>
                        <option value="luxury">Luxury / Premium</option>
                    </select>
                    <button className="w-full text-xs bg-white/[0.04] border border-white/[0.08] rounded-md py-2 text-slate-300 hover:bg-white/[0.06] hover:border-[var(--ocms-accent)]/30 transition-all flex items-center justify-center gap-1.5">
                        <Sparkles className="w-3 h-3" /> Generate A/B Variant
                    </button>
                </FeaturePanel>

                {/* ════ 6. VOICE-TO-EDIT COMMAND CENTER ════ */}
                <FeaturePanel icon={<Mic className="w-3.5 h-3.5" />} title="Voice Commands" tag="New">
                    <p className="text-[10px] text-slate-500 mb-2">Speak a command and the CMS executes the code change.</p>
                    <button onClick={toggleVoice}
                        className={`w-full py-2.5 rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-all ${isListening
                            ? "bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse"
                            : "bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:bg-white/[0.06]"}`}>
                        {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                        {isListening ? "Stop Listening" : "Start Voice Command"}
                    </button>
                    {voiceText && (
                        <div className="mt-2 text-[10px] text-emerald-400 font-[family-name:var(--font-jetbrains-mono)] bg-emerald-400/5 border border-emerald-400/10 rounded-md px-2.5 py-1.5">
                            {voiceText}
                        </div>
                    )}
                </FeaturePanel>

                {/* ════ 7. CROSS-SITE COMPONENT STEALER ════ */}
                <FeaturePanel icon={<Wand2 className="w-3.5 h-3.5" />} title="Component Stealer" tag="AI">
                    <p className="text-[10px] text-slate-500 mb-2">Paste any URL. The AI replicates the component and injects it into your workspace.</p>
                    <div className="flex gap-1.5">
                        <input type="text" value={componentUrl} onChange={(e) => setComponentUrl(e.target.value)}
                            className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-md px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-[var(--ocms-accent)] font-[family-name:var(--font-jetbrains-mono)]"
                            placeholder="https://stripe.com" />
                        <button className="px-3 rounded-md bg-[var(--ocms-accent)]/20 border border-[var(--ocms-accent)]/30 text-[var(--ocms-accent)] text-xs hover:bg-[var(--ocms-accent)]/30 transition-colors">
                            Steal
                        </button>
                    </div>
                </FeaturePanel>

                {/* ════ 8. CODE SANDBOX TOGGLE ════ */}
                <FeaturePanel icon={<Code2 className="w-3.5 h-3.5" />} title="Code Sandbox" tag="Pro">
                    <p className="text-[10px] text-slate-500 mb-2">Toggle between visual controls and raw code editing.</p>
                    <div className="flex rounded-md border border-white/[0.08] overflow-hidden">
                        <button onClick={() => setShowCode(false)}
                            className={`flex-1 py-1.5 text-[10px] font-semibold transition-colors flex items-center justify-center gap-1 ${!showCode ? "bg-[var(--ocms-accent)] text-white" : "text-slate-400 hover:bg-white/[0.04]"}`}>
                            <Eye className="w-3 h-3" /> Visual
                        </button>
                        <button onClick={() => setShowCode(true)}
                            className={`flex-1 py-1.5 text-[10px] font-semibold transition-colors flex items-center justify-center gap-1 ${showCode ? "bg-[var(--ocms-accent)] text-white" : "text-slate-400 hover:bg-white/[0.04]"}`}>
                            <Code2 className="w-3 h-3" /> Code
                        </button>
                    </div>
                    {showCode && (
                        <div className="mt-2 bg-black/40 border border-white/[0.06] rounded-md p-2.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-emerald-300 leading-relaxed max-h-32 overflow-y-auto">
                            <span className="text-slate-500">{'<'}</span>
                            <span className="text-sky-400">h1</span>
                            <span className="text-slate-500">{'>'}</span>
                            {schema.find(f => f.id === "hero-title")?.value || "Welcome"}
                            <span className="text-slate-500">{'</'}</span>
                            <span className="text-sky-400">h1</span>
                            <span className="text-slate-500">{'>'}</span>
                        </div>
                    )}
                </FeaturePanel>

                {/* ════ 9. LIGHTHOUSE SCORE PREDICTOR ════ */}
                <FeaturePanel icon={<Gauge className="w-3.5 h-3.5" />} title="Lighthouse Predictor" tag="Live">
                    <p className="text-[10px] text-slate-500 mb-2">Live prediction of your Google Lighthouse score before publishing.</p>
                    <div className="flex items-center gap-3">
                        <div className="relative w-14 h-14">
                            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                                <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                                <circle cx="28" cy="28" r="24" fill="none"
                                    stroke={lighthouseScore >= 90 ? "#10b981" : lighthouseScore >= 50 ? "#f59e0b" : "#ef4444"}
                                    strokeWidth="4" strokeLinecap="round"
                                    strokeDasharray={`${(lighthouseScore / 100) * 151} 151`} />
                            </svg>
                            <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold font-[family-name:var(--font-jetbrains-mono)] ${lighthouseScore >= 90 ? "text-emerald-400" : lighthouseScore >= 50 ? "text-amber-400" : "text-red-400"}`}>
                                {lighthouseScore}
                            </span>
                        </div>
                        <div className="flex-1 space-y-1">
                            {[
                                { label: "Performance", score: lighthouseScore },
                                { label: "Accessibility", score: 98 },
                                { label: "SEO", score: 95 },
                            ].map((m) => (
                                <div key={m.label} className="flex items-center gap-2">
                                    <span className="text-[9px] text-slate-500 w-16">{m.label}</span>
                                    <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                                        <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${m.score}%` }} />
                                    </div>
                                    <span className="text-[9px] text-slate-400 font-[family-name:var(--font-jetbrains-mono)] w-5 text-right">{m.score}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </FeaturePanel>

                {/* ════ 10. SCROLL-TRIGGER ANIMATION BUILDER ════ */}
                <FeaturePanel icon={<Zap className="w-3.5 h-3.5" />} title="Scroll Animations" tag="New">
                    <p className="text-[10px] text-slate-500 mb-2">Visually connect blocks to scroll depth for entrance animations.</p>
                    <div className="space-y-2">
                        {[
                            { el: "Hero Title", trigger: "0%", anim: "Fade Up" },
                            { el: "CTA Button", trigger: "15%", anim: "Slide Right" },
                            { el: "Feature Grid", trigger: "30%", anim: "Scale In" },
                        ].map((rule) => (
                            <div key={rule.el} className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.06] rounded-md px-2.5 py-1.5">
                                <span className="text-[9px] text-slate-300 font-semibold flex-1">{rule.el}</span>
                                <span className="text-[8px] font-[family-name:var(--font-jetbrains-mono)] text-[var(--ocms-accent)] bg-[var(--ocms-accent)]/10 px-1.5 py-0.5 rounded">{rule.trigger}</span>
                                <span className="text-[8px] font-[family-name:var(--font-jetbrains-mono)] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">{rule.anim}</span>
                            </div>
                        ))}
                        <button className="w-full text-xs bg-white/[0.04] border border-white/[0.08] rounded-md py-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-all flex items-center justify-center gap-1">
                            + Add Animation Rule
                        </button>
                    </div>
                </FeaturePanel>
            </div>

            {/* ─── Footer Action ─── */}
            <div className="px-3.5 py-3 border-t border-white/[0.08] bg-white/[0.01] space-y-2">
                {syncStatus === "error" && errorMessage && (
                    <div className="flex items-center gap-2 text-[10px] text-red-400 font-[family-name:var(--font-jetbrains-mono)] bg-red-400/10 border border-red-400/20 rounded-md px-2.5 py-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{errorMessage}</span>
                    </div>
                )}
                <button onClick={handleSaveAndSync} disabled={syncStatus === "syncing"}
                    className={`w-full py-2.5 rounded-md text-xs font-bold tracking-wide transition-all flex items-center justify-center gap-2 ${syncStatus === "success"
                        ? "bg-emerald-500 text-white"
                        : syncStatus === "error"
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : "bg-[var(--ocms-accent)] text-white hover:brightness-110 shadow-[0_0_20px_rgba(59,130,246,0.15)]"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}>
                    {syncStatus === "syncing" ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>AI is modifying code...</span></>
                    ) : syncStatus === "success" ? (
                        <><Check className="w-3.5 h-3.5" /><span>Pushed to GitHub!</span></>
                    ) : syncStatus === "error" ? (
                        <><AlertCircle className="w-3.5 h-3.5" /><span>Sync Failed — Retry</span></>
                    ) : (
                        <><GitBranch className="w-3.5 h-3.5" /><span>Save & Sync to GitHub</span></>
                    )}
                </button>
            </div>
        </div>
    );
}
