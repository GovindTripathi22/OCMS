"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    Type, ImageIcon, Link2, Box, Loader2, Check, AlertCircle,
    Mic, MicOff, Palette, Code2, Clock, Gauge, Sparkles,
    MousePointer2, Copy, Wand2, ChevronDown, ChevronRight,
    GitBranch, Zap, Eye, ShieldCheck, ShieldAlert, Clipboard, List, Settings
} from "lucide-react";
import dynamic from "next/dynamic";
import ModelDropzone from "./ModelDropzone";
import type { SchemaField } from "@/types/schema";
import { PBR_PRESETS } from "@/lib/pbr-presets";


const ModelViewer = dynamic(() => import("./ModelViewer"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center bg-white border-[3px] border-black rounded-md shadow-[4px_4px_0_0_#000]">
            <div className="w-6 h-6 border-[3px] border-black border-t-transparent rounded-full animate-spin" />
        </div>
    ),
});

interface ContentEditorProps {
    projectId: string;
    schema: SchemaField[];
    initialSchema?: SchemaField[];
    onFieldChange: (fieldId: string, newValue: string) => void;
    onFieldUpdate?: (fieldId: string, updates: Partial<SchemaField>) => void;
    onModelInjected: (targetFieldId: string, modelPath: string) => void;
    githubOwner?: string;
    githubRepo?: string;
    targetFilePath?: string;
    onHistorySeek?: (percent: number) => void;
    historyCount?: number;
    historyIndex?: number;
    onHistoryIndexChange?: (index: number) => void;
    onSchemaReplace?: (newSchema: SchemaField[]) => void;
    broadcastGhostEvent?: (type: "AI_EDIT_START" | "AI_EDIT_END", selector?: string, text?: string) => void;
    previewUrl?: string;
    isScanning?: boolean;
    onScanPage?: (skipAi?: boolean) => void;
    openPermissionWizard?: () => void;
}

const fieldIcons: Record<SchemaField["type"], React.ReactNode> = {
    text: <Type className="w-3.5 h-3.5" />,
    image: <ImageIcon className="w-3.5 h-3.5" />,
    link: <Link2 className="w-3.5 h-3.5" />,
    "3d-model": <Box className="w-3.5 h-3.5" />,
    list: <List className="w-3.5 h-3.5" />,
};

type SyncStatus = "idle" | "syncing" | "success" | "error";

interface SpeechRecognitionResultLike {
    0: {
        transcript: string;
    };
}

interface SpeechRecognitionEventLike {
    results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onstart: (() => void) | null;
    onresult: ((event: SpeechRecognitionEventLike) => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
    start: () => void;
    stop: () => void;
}

interface SpeechRecognitionConstructor {
    new (): SpeechRecognitionLike;
}

type SpeechWindow = Window & typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const FEATURE_PANEL_COLOR_MAP: Record<string, { bg: string; text: string; shadow: string }> = {
    yellow: { bg: "bg-[var(--ocms-yellow)]", text: "text-black", shadow: "shadow-[4px_4px_0px_#000]" },
    green: { bg: "bg-[var(--ocms-green)]", text: "text-black", shadow: "shadow-[4px_4px_0px_#000]" },
    blue: { bg: "bg-[var(--ocms-blue)]", text: "text-black", shadow: "shadow-[4px_4px_0px_#000]" },
    orange: { bg: "bg-[var(--ocms-orange)]", text: "text-black", shadow: "shadow-[4px_4px_0px_#000]" },
    pink: { bg: "bg-[var(--ocms-pink)]", text: "text-black", shadow: "shadow-[4px_4px_0px_#000]" },
    cyan: { bg: "bg-[var(--ocms-cyan)]", text: "text-black", shadow: "shadow-[4px_4px_0px_#000]" },
};

/* ─── Boxy Colorful Feature Panel ─── */
function FeaturePanel({ icon, title, tag, children, defaultOpen = false, accentColor = "yellow" }: {
    icon: React.ReactNode; title: string; tag?: string;
    children: React.ReactNode; defaultOpen?: boolean;
    accentColor?: "yellow" | "green" | "blue" | "orange" | "pink" | "cyan";
}) {
    const [open, setOpen] = useState(defaultOpen);

    // colorMap moved to module level for performance

    const c = FEATURE_PANEL_COLOR_MAP[accentColor] || FEATURE_PANEL_COLOR_MAP.yellow;

    const tagStyles = tag === "AI"
        ? "bg-[var(--ocms-pink)] border-2 border-black text-black shadow-[2px_2px_0px_#000]"
        : tag === "New"
        ? "bg-[var(--ocms-green)] border-2 border-black text-black shadow-[2px_2px_0px_#000]"
        : tag === "PBR"
        ? "bg-[var(--ocms-orange)] border-2 border-black text-black shadow-[2px_2px_0px_#000]"
        : tag === "Pro"
        ? "bg-[var(--ocms-cyan)] border-2 border-black text-black shadow-[2px_2px_0px_#000]"
        : "bg-[var(--ocms-blue)] border-2 border-black text-black shadow-[2px_2px_0px_#000]";

    return (
        <div className={`border-[3px] border-black rounded-md overflow-hidden transition-all duration-300 ${
            open
            ? `${c.bg} ${c.text} ${c.shadow}`
            : "bg-white text-black shadow-[4px_4px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_var(--ocms-orange)]"
        }`}>
            <button onClick={() => setOpen(!open)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all text-black ${
                    open ? "border-b-[3px] border-black bg-white" : "bg-white"
                }`}>
                <span className="text-black">{icon}</span>
                <span className="text-xs font-black uppercase tracking-wide flex-1">{title}</span>
                {tag && <span className={`text-[8px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-[4px] ${tagStyles}`}>{tag}</span>}
                {open ? <ChevronDown className="w-4 h-4 text-black transition-transform duration-300" /> : <ChevronRight className="w-4 h-4 text-black transition-transform duration-300" />}
            </button>
            {open && (
                <div className="px-4 pb-4 pt-3 animate-fade-in text-black">
                    {children}
                </div>
            )}
        </div>
    );
}

const COPY_TEMPLATES = [
    { name: "⚡ Choose Copy Template...", value: "" },
    { name: "Headline: The Ultimate [Product] for [Audience]", value: "The Ultimate Platform for Modern Developers" },
    { name: "Value Prop: Simplify [Process] with [Product]", value: "Simplify your headless content workflows with OCMS. Done in minutes." },
    { name: "CTA: Join [Number]+ developers. Start free", value: "Join 10,000+ developers building the future. Start free today." },
    { name: "Social Proof: Trusted by leading teams...", value: "Trusted by leading engineering teams worldwide to power dynamic sites." },
    { name: "Highlight: 10x faster, zero config...", value: "10x faster, zero configuration, and 100% free forever." }
];

// PBR_PRESETS imported from @/lib/pbr-presets

// Hex to HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// HSL to Hex
function hslToHex(h: number, sVal: number, lVal: number): string {
    const s = sVal / 100;
    const l = lVal / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;

    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    const toHex = (n: number) => {
        const hexVal = Math.round((n + m) * 255).toString(16);
        return hexVal.length === 1 ? "0" + hexVal : hexVal;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Generate color harmony
function generateHarmony(baseHex: string, type: "mono" | "analogous" | "triad"): string[] {
    const { h, s, l } = hexToHsl(baseHex);
    
    if (type === "mono") {
        return [
            hslToHex(h, Math.max(10, s - 30), Math.min(95, l + 30)), // Bg (very light)
            baseHex,                                                 // Primary (base)
            hslToHex(h, Math.min(100, s + 10), Math.max(15, l - 15)), // Secondary (darker)
            hslToHex(h, Math.min(100, s + 20), Math.min(90, l + 15)), // Accent (lighter/brighter)
            hslToHex(h, Math.max(10, s - 40), 12),                    // Text (very dark)
        ];
    } else if (type === "analogous") {
        return [
            hslToHex((h + 330) % 360, Math.max(10, s - 20), 93),      // Bg (cool light)
            baseHex,                                                 // Primary
            hslToHex((h + 30) % 360, s, Math.max(20, l - 10)),        // Secondary (+30 deg)
            hslToHex((h + 330) % 360, s, Math.max(20, l - 5)),        // Accent (-30 deg)
            "#1e293b",                                               // Text
        ];
    } else { // triad
        return [
            hslToHex((h + 120) % 360, 20, 95),                       // Bg (very light triad)
            baseHex,                                                 // Primary
            hslToHex((h + 120) % 360, s, l),                         // Secondary (+120 deg)
            hslToHex((h + 240) % 360, s, l),                         // Accent (+240 deg)
            "#0f172a",                                               // Text
        ];
    }
}

export default function ContentEditor({
    projectId,
    schema,
    initialSchema = [],
    onFieldChange,
    onFieldUpdate,
    onModelInjected,
    githubOwner = "GovindTripathi22",
    githubRepo = "OCMS",
    targetFilePath = "src/app/page.tsx",
    onHistorySeek,
    historyCount = 1,
    historyIndex = 0,
    onHistoryIndexChange,
    onSchemaReplace,
    broadcastGhostEvent,
    previewUrl,
    isScanning = false,
    onScanPage,
    openPermissionWizard,
}: ContentEditorProps) {
    const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
    const [errorMessage, setErrorMessage] = useState("");
    const [isListening, setIsListening] = useState(false);
    const [voiceText, setVoiceText] = useState("");
    const [showCode, setShowCode] = useState(false);
    const [timelinePos, setTimelinePos] = useState(100);
    const [lighthouseScore, setLighthouseScore] = useState(0);
    const [accessibilityScore, setAccessibilityScore] = useState(0);
    const [seoScore, setSeoScore] = useState(0);
    const [isAuditingLighthouse, setIsAuditingLighthouse] = useState(false);

    useEffect(() => {
        if (historyCount && historyCount > 1) {
            setTimelinePos(Math.round((historyIndex / (historyCount - 1)) * 100));
        } else {
            setTimelinePos(100);
        }
    }, [historyIndex, historyCount]);

    const handleRunLighthouseAudit = async () => {
        if (!previewUrl) return;
        setIsAuditingLighthouse(true);
        try {
            const res = await fetch("/api/lighthouse-audit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: previewUrl }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to audit page");
            if (data.scores) {
                setLighthouseScore(data.scores.performance);
                setAccessibilityScore(data.scores.accessibility);
                setSeoScore(data.scores.seo);
            }
        } catch (err) {
            console.error("Lighthouse Audit Failed:", err);
            alert(err instanceof Error ? err.message : "Failed to run PageSpeed audit");
        } finally {
            setIsAuditingLighthouse(false);
        }
    };

    const handleScanPage = (skipAi?: boolean) => {
        if (onScanPage) onScanPage(skipAi);
    };

    // Feature States
    const [componentUrl, setComponentUrl] = useState("");
    const [isStealing, setIsStealing] = useState(false);
    const [abTarget, setAbTarget] = useState("gen-z");
    const [isGeneratingVariant, setIsGeneratingVariant] = useState(false);
    const [currentColors, setCurrentColors] = useState(["#fbbf24", "#22c55e", "#3b82f6", "#f97316", "#ec4899"]);
    const [isGhostModeActive, setIsGhostModeActive] = useState(true);

    // R4 Local Utilities states
    const [filterQuery, setFilterQuery] = useState("");
    const [baseColor, setBaseColor] = useState("#fbbf24");
    const [harmonyType, setHarmonyType] = useState<"mono" | "analogous" | "triad">("mono");

    // Auto-update generated harmony colors
    useEffect(() => {
        const palette = generateHarmony(baseColor, harmonyType);
        setCurrentColors(palette);
    }, [baseColor, harmonyType]);

    // GSD Core States
    interface GsdStateData {
        phaseStatus: string;
        currentPhaseNum: number;
        totalPhases: number;
        currentPhase: string;
        currentPlanNum: number;
        totalPlans: number;
        lastActivity: string;
        decisions: string[];
        blockers: string[];
    }

    interface GsdPhaseData {
        number: string;
        name: string;
        description: string;
        status: "Not started" | "In progress" | "Complete";
        plans: Array<{ id: string; name: string; completed: boolean }>;
    }

    interface GsdRequirementData {
        id: string;
        category: string;
        description: string;
        completed: boolean;
    }

    const [gsdState, setGsdState] = useState<GsdStateData | null>(null);
    const [gsdRoadmap, setGsdRoadmap] = useState<GsdPhaseData[]>([]);
    const [gsdRequirements, setGsdRequirements] = useState<GsdRequirementData[]>([]);
    const [gsdLoading, setGsdLoading] = useState(false);
    const [gsdActionLoading, setGsdActionLoading] = useState<string | null>(null);
    const [gsdMessage, setGsdMessage] = useState("");
    const [gsdActiveTab, setGsdActiveTab] = useState<"status" | "roadmap" | "requirements" | "actions">("status");

    const fetchGsdStatus = useCallback(async () => {
        setGsdLoading(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/gsd`);
            const data = await res.json();
            if (data.exists) {
                setGsdState(data.state);
                setGsdRoadmap(data.roadmap);
                setGsdRequirements(data.requirements);
            } else {
                setGsdState(null);
            }
        } catch (err) {
            console.error("Failed to load GSD", err);
        } finally {
            setGsdLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        fetchGsdStatus();
    }, [fetchGsdStatus]);

    const runGsdAction = async (action: string, payload?: Record<string, unknown>) => {
        setGsdActionLoading(action);
        try {
            const res = await fetch(`/api/projects/${projectId}/gsd`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, payload })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Action failed");
            
            await fetchGsdStatus();
            setSyncStatus("success");
            setErrorMessage("");
            if (action === "discuss") setGsdMessage("");
            setTimeout(() => setSyncStatus("idle"), 3000);
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            setErrorMessage(errMsg || "Action failed");
            setSyncStatus("error");
            setTimeout(() => setSyncStatus("idle"), 5000);
        } finally {
            setGsdActionLoading(null);
        }
    };

    // Color palette push state
    const [isApplyingColors, setIsApplyingColors] = useState(false);
    const [colorApplyStatus, setColorApplyStatus] = useState<"idle" | "success" | "error">("idle");
    const [copiedColor, setCopiedColor] = useState<string | null>(null);

    // Build validation state
    const [buildStatus, setBuildStatus] = useState<"unknown" | "checking" | "valid" | "invalid">("unknown");
    const [buildErrors, setBuildErrors] = useState<string[]>([]);

    // 3D Material Editor States
    const [roughness, setRoughness] = useState(0.5);
    const [metalness, setMetalness] = useState(1.0);
    const [textureUrl, setTextureUrl] = useState("");
    const [textureApplyStatus, setTextureApplyStatus] = useState<"idle" | "checking" | "success" | "error">("idle");

    useEffect(() => {
        const iframe = document.querySelector('iframe');
        if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage({
                source: "ocms-material-update",
                roughness,
                metalness,
                textureUrl
            }, "*");
        }
    }, [roughness, metalness, textureUrl]);



    const handleApplyMaterialVariant = async () => {
        const modelField = schema.find(f => f.type === "3d-model");
        if (!modelField) {
            alert("No 3D Model field found in the schema to apply to.");
            return;
        }

        setTextureApplyStatus("checking");
        try {
            const res = await fetch("/api/variants", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    assetId: modelField.id,
                    variantName: `Variant-${Date.now()}`,
                    textureUrl: textureUrl,
                    materialProperties: {
                        roughness,
                        metalness,
                    }
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to save variant");
            }

            setTextureApplyStatus("success");
            setTimeout(() => setTextureApplyStatus("idle"), 3000);
        } catch (err) {
            console.error("Apply Material Variant Error:", err);
            setTextureApplyStatus("error");
            alert(err instanceof Error ? err.message : "Failed to save material variant");
        }
    };

    const voiceTranscriptRef = useRef("");
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

    const handleSaveAndSync = async () => {
        const changedFields = schema.filter((field) => {
            const original = initialSchema.find((item) => item.id === field.id);
            return !original || original.value !== field.value || original.type !== field.type;
        });

        if (changedFields.length === 0) {
            setErrorMessage("No changes to sync.");
            setSyncStatus("error");
            setTimeout(() => setSyncStatus("idle"), 3000);
            return;
        }

        // ── Build Validation Gate ──
        setSyncStatus("syncing");
        setErrorMessage("");
        setBuildStatus("checking");
        try {
            const buildRes = await fetch("/api/validate-build");
            const buildData = await buildRes.json();
            if (!buildData.valid) {
                setBuildStatus("invalid");
                setBuildErrors(buildData.errors || []);
                setErrorMessage(`Build has ${buildData.errorCount} TypeScript error(s). Fix them before pushing.`);
                setSyncStatus("error");
                setTimeout(() => setSyncStatus("idle"), 8000);
                return;
            }
            setBuildStatus("valid");
            setBuildErrors([]);
        } catch {
            // If build check fails, allow the push (non-blocking fallback)
            setBuildStatus("unknown");
            console.warn("Build validation check failed, proceeding anyway...");
        }

        const summary = changedFields
            .map((field) => {
                const original = initialSchema.find((item) => item.id === field.id);
                const fromValue = original?.value ?? "(new field)";
                return `${field.id}: "${(fromValue || "").slice(0, 80)}" -> "${(field.value || "").slice(0, 80)}"`;
            })
            .join("\n");

        const confirmed = window.confirm(`Save & Sync will commit these changes:\n\n${summary}`);
        if (!confirmed) {
            setSyncStatus("idle");
            return;
        }

        const changes = changedFields.map((f) => {
            const original = initialSchema.find((item) => item.id === f.id);
            return {
                fieldId: f.id,
                selector: f.selector,
                type: f.type,
                newValue: f.value,
                oldValue: original?.value || "",
                alt: f.alt,
                objectFit: f.objectFit,
                borderRadius: f.borderRadius,
                roughness: f.roughness,
                metalness: f.metalness,
                textureUrl: f.textureUrl,
            };
        });

        try {
            if (isGhostModeActive && broadcastGhostEvent && changes.length > 0) {
                const firstField = schema.find(f => f.id === changes[0].fieldId);
                if (firstField?.selector) {
                    broadcastGhostEvent("AI_EDIT_START", firstField.selector, "Committing...");
                }
            }

            const res = await fetch("/api/publish-changes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    repoOwner: githubOwner,
                    repoName: githubRepo,
                    filePath: targetFilePath,
                    changes,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Unknown error");
            setSyncStatus("success");

            if (isGhostModeActive && broadcastGhostEvent) {
                broadcastGhostEvent("AI_EDIT_END");
            }
            setTimeout(() => setSyncStatus("idle"), 3000);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to sync";
            setErrorMessage(message);
            setSyncStatus("error");
            setTimeout(() => setSyncStatus("idle"), 5000);
        }
    };

    // ── Apply Color Palette to Live Site ──
    const handleApplyColors = async () => {
        const confirmed = window.confirm(
            `This will update CSS theme variables in your live site's globals.css on GitHub:\n\n` +
            `  --theme-background: ${currentColors[0]}\n` +
            `  --theme-primary: ${currentColors[1]}\n` +
            `  --theme-secondary: ${currentColors[2]}\n` +
            `  --theme-accent: ${currentColors[3]}\n` +
            `  --theme-text: ${currentColors[4]}\n\n` +
            `Continue?`
        );
        if (!confirmed) return;

        setIsApplyingColors(true);
        setColorApplyStatus("idle");
        setErrorMessage("");
        try {
            const res = await fetch("/api/theme-colors", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    repoOwner: githubOwner,
                    repoName: githubRepo,
                    colors: currentColors,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to apply colors");
            setColorApplyStatus("success");
            setTimeout(() => setColorApplyStatus("idle"), 4000);
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : "Failed to apply colors");
            setColorApplyStatus("error");
            setTimeout(() => setColorApplyStatus("idle"), 5000);
        } finally {
            setIsApplyingColors(false);
        }
    };

    // ── Copy color hex to clipboard ──
    const handleCopyColor = async (hex: string) => {
        try {
            await navigator.clipboard.writeText(hex);
            setCopiedColor(hex);
            setTimeout(() => setCopiedColor(null), 1500);
        } catch {
            console.warn("Clipboard write failed");
        }
    };

    const toggleVoice = () => {
        if (isListening) {
            if (recognitionRef.current) recognitionRef.current.stop();
            setIsListening(false);
            setVoiceText("");
            return;
        }

        const speechWindow = window as SpeechWindow;
        const SpeechRecognition =
            speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setErrorMessage("Speech recognition not supported in this browser.");
            setSyncStatus("error");
            setTimeout(() => setSyncStatus("idle"), 3000);
            return;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onstart = () => {
            setIsListening(true);
            voiceTranscriptRef.current = "";
            setVoiceText("Listening...");
        };

        recognition.onresult = (event) => {
            const transcript = Array.from(
                event.results,
                (result) => result[0].transcript
            ).join(" ");
            voiceTranscriptRef.current = transcript;
            setVoiceText(`"${transcript}"`);
        };

        recognition.onend = async () => {
            setIsListening(false);
            const finalTranscript = voiceTranscriptRef.current.trim();
            if (finalTranscript && finalTranscript !== "Listening...") {
                setSyncStatus("syncing");
                try {
                    const res = await fetch("/api/parse-voice-command", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ prompt: finalTranscript, schema }),
                    });
                    const data = await res.json();
                    if (data.fieldId && data.newValue) {
                        if (isGhostModeActive && broadcastGhostEvent) {
                            const field = schema.find(f => f.id === data.fieldId);
                            if (field?.selector) {
                                broadcastGhostEvent("AI_EDIT_START", field.selector, "Voice AI");
                            }
                        }

                        onFieldChange(data.fieldId, data.newValue);
                        setSyncStatus("success");

                        if (isGhostModeActive && broadcastGhostEvent) {
                            setTimeout(() => broadcastGhostEvent("AI_EDIT_END"), 2000);
                        }
                    } else {
                        throw new Error("AI couldn't understand the command");
                    }
                } catch {
                    setErrorMessage("Voice edit failed");
                    setSyncStatus("error");
                }
                setTimeout(() => { setSyncStatus("idle"); setVoiceText(""); }, 3000);
            }
        };

        recognition.onerror = () => {
            setIsListening(false);
            setVoiceText("");
        };

        recognition.start();
    };

    const handleGenerateVariant = async () => {
        setIsGeneratingVariant(true);
        setErrorMessage("");
        try {
            const res = await fetch("/api/generate-ab-variant", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ schema, targetAudience: abTarget }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to generate variant");
            if (data.schema && onSchemaReplace) {
                onSchemaReplace(data.schema);
            }
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : "Failed to generate variant");
        } finally {
            setIsGeneratingVariant(false);
        }
    };



    const handleStealComponent = async () => {
        if (!componentUrl) return;
        setIsStealing(true);
        setErrorMessage("");
        try {
            const res = await fetch("/api/steal-component", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: componentUrl }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to steal component");
            alert("Component stolen successfully! (Code logged to console)");
            console.log("STOLEN COMPONENT CODE:\n", data.code);
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : "Failed to steal component");
        } finally {
            setIsStealing(false);
            setComponentUrl("");
        }
    };

    const normalizePath = (pathStr: string | null | undefined): string => {
        if (!pathStr) return "/";
        let p = pathStr.trim().toLowerCase();
        try {
            if (p.startsWith("http://") || p.startsWith("https://")) {
                p = new URL(p).pathname;
            }
        } catch {}
        if (p === "/" || p === "" || p === "/index.html" || p === "/index.htm" || p === "/index" || p === "/home") {
            return "/";
        }
        if (p.endsWith("/")) {
            p = p.slice(0, -1);
        }
        return p;
    };

    let currentPath = "/";
    try {
        if (previewUrl) {
            currentPath = new URL(previewUrl).pathname;
        }
    } catch (e) {
        console.error("Failed to parse current path:", e);
    }

    const filteredSchema = schema.filter((field) => {
        return normalizePath(field.path) === normalizePath(currentPath);
    });

    const displayFields = filteredSchema.filter((field) => {
        if (!filterQuery) return true;
        const q = filterQuery.toLowerCase();
        return (
            (field.label || "").toLowerCase().includes(q) ||
            field.id.toLowerCase().includes(q) ||
            (field.selector || "").toLowerCase().includes(q)
        );
    });

    return (
        <div className="flex flex-col flex-1 h-full min-h-0 font-[family-name:var(--font-space-grotesk)]">
            {/* ─── Header — Boxy Poppy ─── */}
            <div className="relative px-5 py-4 border-b-[3px] border-black bg-white overflow-hidden">
                {/* Rainbow accent line at top */}
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[var(--ocms-orange)] via-[var(--ocms-yellow)] via-[var(--ocms-green)] via-[var(--ocms-blue)] to-[var(--ocms-pink)]" />
                <div className="flex items-center gap-3">
                    <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--ocms-green)] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--ocms-green)] border border-black shadow-[1px_1px_0px_#000]"></span>
                    </div>
                    <h2 className="text-sm font-black text-black tracking-tight uppercase font-sans">OCMS Editor</h2>
                    {/* Build Status Indicator */}
                    {buildStatus !== "unknown" && (
                        <span className={`text-[8px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-[4px] border-2 border-black shadow-[1px_1px_0px_#000] flex items-center gap-1 ${
                            buildStatus === "valid" ? "bg-[var(--ocms-green)] text-black" :
                            buildStatus === "invalid" ? "bg-[var(--ocms-orange)] text-white" :
                            "bg-[var(--ocms-yellow)] text-black animate-pulse"
                        }`}>
                            {buildStatus === "valid" ? <ShieldCheck className="w-2.5 h-2.5" /> :
                             buildStatus === "invalid" ? <ShieldAlert className="w-2.5 h-2.5" /> :
                             <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                            {buildStatus === "checking" ? "TSC" : buildStatus === "valid" ? "OK" : "ERR"}
                        </span>
                    )}
                    <span className="ml-auto text-[9px] font-extrabold uppercase text-black bg-[var(--ocms-yellow)] border-2 border-black px-2.5 py-0.5 rounded-[4px] tracking-widest font-[family-name:var(--font-jetbrains-mono)] shadow-[2px_2px_0px_#000]">
                        v2.5
                    </span>
                </div>
                <p className="text-[9px] text-slate-800 mt-1.5 font-[family-name:var(--font-jetbrains-mono)] flex items-center gap-1.5 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--ocms-blue)] border border-black" /> ID: {projectId.slice(0, 12)}...
                </p>
            </div>

            {/* ─── Scrollable Content ─── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[var(--ocms-bg)]">

                {/* ════ SCHEMA FIELDS ════ */}
                <FeaturePanel icon={<Type className="w-3.5 h-3.5" />} title="Content Fields" tag="Live" accentColor="yellow" defaultOpen>
                    <div className="space-y-3.5 mt-1.5">
                        {filteredSchema.length === 0 ? (
                            <div className="border-[3px] border-black border-dashed bg-white p-5 rounded-md text-center">
                                <Sparkles className="w-8 h-8 text-[var(--ocms-yellow)] mx-auto mb-2 animate-pulse" />
                                <p className="text-xs font-black uppercase text-black tracking-wide">No editable fields here</p>
                                <p className="text-[10px] text-slate-700 mt-1 font-bold">This page hasn&apos;t been scanned by AI yet.</p>
                                <div className="flex gap-2 mt-4">
                                    <button
                                        type="button"
                                        onClick={() => handleScanPage(false)}
                                        disabled={isScanning}
                                        className="flex-1 py-2.5 bg-[var(--ocms-blue)] text-black font-black uppercase tracking-wider text-[10px] border-[3px] border-black rounded-md shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                                    >
                                        {isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                                        {isScanning ? "Scanning..." : "AI Scan"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleScanPage(true)}
                                        disabled={isScanning}
                                        className="flex-1 py-2.5 bg-white text-black font-black uppercase tracking-wider text-[10px] border-[3px] border-black rounded-md shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                                    >
                                        {isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Code2 className="w-3.5 h-3.5" />}
                                        {isScanning ? "Scanning..." : "Fast Scan (No AI)"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* R4: Sidebar Filter Input */}
                                <div className="relative mb-3">
                                    <input
                                        type="text"
                                        placeholder="🔍 Filter fields by label, ID, or selector..."
                                        value={filterQuery}
                                        onChange={(e) => setFilterQuery(e.target.value)}
                                        className="w-full bg-white border-[3px] border-black rounded-md px-3.5 py-2 text-xs text-black placeholder-slate-500 outline-none focus:shadow-[2px_2px_0px_var(--ocms-yellow)] font-bold shadow-[2px_2px_0px_#000]"
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleScanPage(false)}
                                        disabled={isScanning}
                                        className="flex-1 py-2 bg-white text-black font-black uppercase tracking-wider text-[10px] border-[3px] border-black rounded-md shadow-[2px_2px_0px_#000] hover:bg-[var(--ocms-yellow)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                                    >
                                        {isScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                        {isScanning ? "Scanning..." : "Rescan (AI)"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleScanPage(true)}
                                        disabled={isScanning}
                                        className="flex-1 py-2 bg-white text-black font-black uppercase tracking-wider text-[10px] border-[3px] border-black rounded-md shadow-[2px_2px_0px_#000] hover:bg-[var(--ocms-green)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                                    >
                                        {isScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Code2 className="w-3.5 h-3.5" />}
                                        {isScanning ? "Scanning..." : "Rescan (No AI)"}
                                    </button>
                                </div>

                                {displayFields.map((field) => {
                                    const fieldLabel = field.label || field.id;
                                    const iconColors: Record<SchemaField["type"], string> = {
                                        text: "text-black bg-[var(--ocms-yellow)] border-2 border-black shadow-[2px_2px_0px_#000]",
                                        image: "text-black bg-[var(--ocms-cyan)] border-2 border-black shadow-[2px_2px_0px_#000]",
                                        link: "text-black bg-[var(--ocms-green)] border-2 border-black shadow-[2px_2px_0px_#000]",
                                        "3d-model": "text-black bg-[var(--ocms-orange)] border-2 border-black shadow-[2px_2px_0px_#000]",
                                        list: "text-black bg-[var(--ocms-pink)] border-2 border-black shadow-[2px_2px_0px_#000]",
                                    };

                                    return (
                                    <div key={field.id} className="group border-[3px] border-black bg-white hover:bg-slate-50 hover:shadow-[4px_4px_0px_#000] p-3.5 rounded-md transition-all duration-300">
                                        <div className="flex items-center gap-2.5 mb-2.5">
                                            <span className={`p-1.5 rounded-lg flex items-center justify-center ${iconColors[field.type] || "text-black bg-white border-2 border-black"}`}>{fieldIcons[field.type]}</span>
                                            <label className="text-[9px] font-black text-black uppercase tracking-wider">
                                                {fieldLabel}
                                            </label>
                                            <span className="ml-auto text-[8px] font-extrabold uppercase tracking-widest font-[family-name:var(--font-jetbrains-mono)] text-black bg-[var(--ocms-blue)] px-2 py-0.5 rounded-md border-2 border-black shadow-[2px_2px_0px_#000]">
                                                {field.type}
                                            </span>
                                        </div>
                                        {field.type === "3d-model" ? (
                                            <div className="rounded-md overflow-hidden border-[3px] border-black bg-white h-40 shadow-inner group-hover:shadow-[4px_4px_0px_#000] transition-all">
                                                <ModelViewer 
                                                    modelPath={field.value} 
                                                    textureUrl={textureUrl}
                                                    roughness={roughness}
                                                    metalness={metalness}
                                                />
                                            </div>
                                        ) : field.type === "image" ? (
                                            <div className="space-y-2">
                                                <input type="text" value={field.value}
                                                    onChange={(e) => onFieldChange(field.id, e.target.value)}
                                                    className="w-full bg-white border-[3px] border-black rounded-md px-3.5 py-2.5 text-xs text-black placeholder-slate-500 outline-none focus:shadow-[3px_3px_0px_var(--ocms-cyan)] transition-all font-[family-name:var(--font-jetbrains-mono)]"
                                                    placeholder="Image URL..." />
                                                
                                                <div className="relative rounded-md border-[3px] border-dashed border-black bg-[#fcfbf9] hover:bg-[var(--ocms-cyan-glow)] hover:shadow-[3px_3px_0px_#000] hover:-translate-x-[2px] hover:-translate-y-[2px] p-4 text-center cursor-pointer transition-all duration-300">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                                const reader = new FileReader();
                                                                reader.onload = (event) => {
                                                                    const base64Url = event.target?.result as string;
                                                                    if (base64Url) {
                                                                        onFieldChange(field.id, base64Url);
                                                                    }
                                                                };
                                                                reader.readAsDataURL(file);
                                                            }
                                                        }}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    />
                                                    <div className="flex flex-col items-center gap-1.5 py-1">
                                                        <div className="p-1.5 rounded-md bg-white border-2 border-black shadow-[2px_2px_0px_#000]">
                                                            <ImageIcon className="w-4 h-4 text-black" />
                                                        </div>
                                                        <span className="text-[9px] text-black font-extrabold uppercase tracking-wide">
                                                            Click or drop to upload local image
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            field.value.length > 50 || field.originalHtmlTag === "p" || field.originalHtmlTag === "span" || field.originalHtmlTag === "div" ? (
                                                <div className="space-y-1.5">
                                                    <textarea value={field.value}
                                                        onChange={(e) => onFieldChange(field.id, e.target.value)}
                                                        rows={Math.min(6, Math.max(2, Math.ceil(field.value.length / 40)))}
                                                        className="w-full bg-white border-[3px] border-black rounded-md px-3.5 py-2.5 text-xs text-black placeholder-slate-500 outline-none focus:shadow-[3px_3px_0px_var(--ocms-yellow)] transition-all font-bold"
                                                        placeholder={`Enter ${fieldLabel.toLowerCase()}...`} />
                                                    <select
                                                        onChange={(e) => {
                                                            if (e.target.value) {
                                                                onFieldChange(field.id, e.target.value);
                                                                e.target.value = "";
                                                            }
                                                        }}
                                                        className="w-full bg-white border-[2.5px] border-black rounded-md px-2 py-1 text-[10px] text-slate-700 outline-none focus:shadow-[2px_2px_0px_var(--ocms-yellow)] font-bold cursor-pointer"
                                                    >
                                                        {COPY_TEMPLATES.map((t) => (
                                                            <option key={t.name} value={t.value}>{t.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    <input type="text" value={field.value}
                                                        onChange={(e) => onFieldChange(field.id, e.target.value)}
                                                        className="w-full bg-white border-[3px] border-black rounded-md px-3.5 py-2.5 text-xs text-black placeholder-slate-500 outline-none focus:shadow-[3px_3px_0px_var(--ocms-yellow)] transition-all font-bold"
                                                        placeholder={`Enter ${fieldLabel.toLowerCase()}...`} />
                                                    <select
                                                        onChange={(e) => {
                                                            if (e.target.value) {
                                                                onFieldChange(field.id, e.target.value);
                                                                e.target.value = "";
                                                            }
                                                        }}
                                                        className="w-full bg-white border-[2.5px] border-black rounded-md px-2 py-1 text-[10px] text-slate-700 outline-none focus:shadow-[2px_2px_0px_var(--ocms-yellow)] font-bold cursor-pointer"
                                                    >
                                                        {COPY_TEMPLATES.map((t) => (
                                                            <option key={t.name} value={t.value}>{t.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )
                                        )}
                                    </div>
                                    );
                                })}
                            </>
                        )}
                    </div>
                </FeaturePanel>

                {/* ════ 3D MODEL INJECTOR ════ */}
                <FeaturePanel icon={<Box className="w-3.5 h-3.5" />} title="3D Model Injector" tag="New" accentColor="orange">
                    <p className="text-[10px] text-slate-800 mb-2.5 font-bold">Drag & drop .glb files to inject a 3D asset into the live code.</p>
                    <ModelDropzone projectId={projectId} targetFieldId="new-3d-asset" onModelInjected={onModelInjected} />
                </FeaturePanel>

                {/* ════ 3D MATERIAL EDITOR ════ */}
                {schema.some(f => f.type === "3d-model") && (
                    <FeaturePanel icon={<Palette className="w-3.5 h-3.5" />} title="3D Material Editor" tag="PBR" accentColor="orange" defaultOpen>
                        <div className="space-y-3 mt-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-800 uppercase font-black tracking-tighter">Selected Model</span>
                                <span className="text-[9px] text-black font-black uppercase bg-[var(--ocms-orange)] px-2 py-0.5 border-2 border-black rounded-[4px] shadow-[2px_2px_0px_#000]">Hero Asset</span>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[9px] text-slate-800 uppercase font-black">PBR Material Presets</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {PBR_PRESETS.map((preset) => (
                                        <button
                                            key={preset.name}
                                            type="button"
                                            onClick={() => {
                                                setRoughness(preset.roughness);
                                                setMetalness(preset.metalness);
                                                setTextureUrl(preset.textureUrl);
                                                const modelField = schema.find(f => f.type === "3d-model");
                                                if (modelField && onFieldUpdate) {
                                                    onFieldUpdate(modelField.id, {
                                                        roughness: preset.roughness,
                                                        metalness: preset.metalness,
                                                        textureUrl: preset.textureUrl
                                                    });
                                                }
                                            }}
                                            className="flex items-center gap-2 p-1.5 border-2 border-black rounded-md bg-white hover:bg-slate-50 active:translate-x-[0.5px] active:translate-y-[0.5px] shadow-[2px_2px_0px_#000] active:shadow-none transition-all text-left"
                                        >
                                            <span
                                                className="w-3.5 h-3.5 rounded-full border border-black shrink-0"
                                                style={{
                                                    backgroundColor: preset.previewColor,
                                                    backgroundImage: `url("${preset.textureUrl}")`,
                                                    backgroundSize: 'cover'
                                                }}
                                            />
                                            <span className="text-[8px] font-black uppercase tracking-tight">{preset.name}</span>
                                        </button>
                                    ))}
                                </div>
                                {textureUrl && (
                                    <div className="text-[8px] text-slate-500 font-mono break-all line-clamp-1 bg-slate-100 p-1 border border-slate-300 rounded mt-1.5">
                                        Active Texture: {textureUrl.startsWith("data:") ? "SVG Preset Texture" : textureUrl}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[8px] text-slate-800 uppercase font-black flex justify-between">
                                        Roughness <span className="text-black font-black bg-[var(--ocms-yellow)] border border-black px-1 rounded-[2px]">{roughness.toFixed(2)}</span>
                                    </label>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="1" 
                                        step="0.05" 
                                        value={roughness}
                                        onChange={(e) => setRoughness(parseFloat(e.target.value))}
                                        className="w-full h-2 bg-white border-2 border-black rounded-full accent-black cursor-pointer" 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] text-slate-800 uppercase font-black flex justify-between">
                                        Metalness <span className="text-black font-black bg-[var(--ocms-blue)] border border-black px-1 rounded-[2px]">{metalness.toFixed(2)}</span>
                                    </label>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="1" 
                                        step="0.05" 
                                        value={metalness}
                                        onChange={(e) => setMetalness(parseFloat(e.target.value))}
                                        className="w-full h-2 bg-white border-2 border-black rounded-full accent-black cursor-pointer" 
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={handleApplyMaterialVariant}
                                disabled={textureApplyStatus === "checking"}
                                className={`w-full py-2.5 border-[3px] border-black rounded-md text-[9px] font-black uppercase shadow-[3px_3px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all ${
                                    textureApplyStatus === "success"
                                        ? "bg-[var(--ocms-green)] text-black"
                                        : textureApplyStatus === "error"
                                            ? "bg-red-500 text-white"
                                            : "bg-white text-black hover:bg-[var(--ocms-orange)] hover:text-white"
                                }`}
                            >
                                {textureApplyStatus === "checking" ? (
                                    <span className="flex items-center justify-center gap-1">
                                        <Loader2 className="w-3 h-3 animate-spin" /> Saving Variant...
                                    </span>
                                ) : textureApplyStatus === "success" ? (
                                    "✓ Variant Saved to CMS!"
                                ) : textureApplyStatus === "error" ? (
                                    "⚠ Error Saving! Retry"
                                ) : "APPLY MATERIAL VARIANT"}
                            </button>
                        </div>
                    </FeaturePanel>
                )}

                {/* ════ TIME TRAVEL PREVIEW ════ */}
                <FeaturePanel icon={<Clock className="w-3.5 h-3.5" />} title="Time Travel Preview" tag="New" accentColor="cyan">
                    <p className="text-[10px] text-slate-800 mb-2.5 font-bold">Scrub through your edit history and watch the preview rewind.</p>
                    <div className="flex items-center gap-2.5">
                        <span className="text-[9px] text-black font-black font-[family-name:var(--font-jetbrains-mono)]">START</span>
                        <input type="range" min={0} max={100} value={timelinePos}
                            onChange={(e) => {
                                const val = Number(e.target.value);
                                setTimelinePos(val);
                                onHistorySeek?.(val);
                            }}
                            className="flex-1 h-2 bg-white border-2 border-black rounded-full accent-black cursor-pointer" />
                        <span className="text-[9px] text-black font-black font-[family-name:var(--font-jetbrains-mono)]">NOW</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-[9px] text-slate-800 font-bold">{timelinePos}% of session</span>
                        <span className="text-[9px] text-black bg-[var(--ocms-green)] border-2 border-black px-2 py-0.5 rounded-[4px] shadow-[2px_2px_0px_#000] font-[family-name:var(--font-jetbrains-mono)] font-black uppercase">{historyCount} edits</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                        <button
                            type="button"
                            onClick={() => {
                                if (onHistoryIndexChange && historyIndex !== undefined && historyIndex > 0) {
                                    onHistoryIndexChange(historyIndex - 1);
                                }
                            }}
                            disabled={!(historyIndex !== undefined && historyIndex > 0)}
                            className="flex-1 py-1.5 bg-white text-black border-[3px] border-black rounded-md text-[9px] font-black uppercase shadow-[2px_2px_0px_#000] hover:bg-slate-100 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-[2px_2px_0px_#000] hover:translate-x-0 hover:translate-y-0 active:translate-x-0 active:translate-y-0 transition-all font-bold"
                        >
                            ↺ Undo
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (onHistoryIndexChange && historyIndex !== undefined && historyCount !== undefined && historyIndex < historyCount - 1) {
                                    onHistoryIndexChange(historyIndex + 1);
                                }
                            }}
                            disabled={!(historyIndex !== undefined && historyCount !== undefined && historyIndex < historyCount - 1)}
                            className="flex-1 py-1.5 bg-white text-black border-[3px] border-black rounded-md text-[9px] font-black uppercase shadow-[2px_2px_0px_#000] hover:bg-slate-100 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-[2px_2px_0px_#000] hover:translate-x-0 hover:translate-y-0 active:translate-x-0 active:translate-y-0 transition-all font-bold"
                        >
                            ↻ Redo
                        </button>
                    </div>
                </FeaturePanel>

                {/* ════ GSD CORE ORCHESTRATOR ════ */}
                <FeaturePanel icon={<GitBranch className="w-3.5 h-3.5" />} title="GSD Core Orchestrator" tag="Phase" accentColor="pink">
                    {gsdLoading ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="w-5 h-5 animate-spin text-black" />
                        </div>
                    ) : !gsdState ? (
                        <div className="space-y-3">
                            <p className="text-[10px] text-slate-800 font-bold">
                                Integrate GSD Core spec-driven planning and sub-agent workflows in your target GitHub repository.
                            </p>
                            <button
                                onClick={() => runGsdAction("init")}
                                disabled={gsdActionLoading === "init"}
                                className="w-full text-xs bg-[var(--ocms-pink)] border-[3px] border-black rounded-md py-2 text-black hover:bg-[var(--ocms-orange)] hover:text-white shadow-[3px_3px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all font-black uppercase disabled:opacity-50"
                            >
                                {gsdActionLoading === "init" ? (
                                    <span className="flex items-center justify-center gap-1">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> INITIALIZING...
                                    </span>
                                ) : (
                                    "INITIALIZE GSD PLANNING"
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Navigation Tabs */}
                            <div className="flex border-b border-black/10 pb-2 gap-1.5 overflow-x-auto">
                                {(["status", "roadmap", "requirements", "actions"] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setGsdActiveTab(tab)}
                                        className={`text-[9px] font-black uppercase px-2 py-1 border border-black rounded-[4px] shadow-[1px_1px_0px_#000] hover:translate-x-[-0.5px] hover:translate-y-[-0.5px] transition-all ${
                                            gsdActiveTab === tab
                                                ? "bg-[var(--ocms-yellow)] text-black"
                                                : "bg-white text-black hover:bg-slate-100"
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            {/* Tab Content */}
                            {gsdActiveTab === "status" && (
                                <div className="space-y-2.5">
                                    <div className="bg-slate-50 border-2 border-black rounded-[4px] p-2 font-mono text-[9px] text-slate-800 space-y-1.5 shadow-[2px_2px_0px_rgba(0,0,0,0.05)]">
                                        <div><strong className="text-black uppercase">Phase Status:</strong> {gsdState.phaseStatus}</div>
                                        <div><strong className="text-black uppercase">Current Phase:</strong> {gsdState.currentPhaseNum} of {gsdState.totalPhases} ({gsdState.currentPhase})</div>
                                        <div><strong className="text-black uppercase">Plan Index:</strong> {gsdState.currentPlanNum} of {gsdState.totalPlans}</div>
                                        <div><strong className="text-black uppercase">Last Activity:</strong> {gsdState.lastActivity}</div>
                                    </div>
                                    
                                    {gsdState.decisions.length > 0 && (
                                        <div>
                                            <h4 className="text-[10px] font-black uppercase mb-1">Key Decisions</h4>
                                            <ul className="text-[9px] text-slate-800 space-y-1 list-disc pl-3">
                                                {gsdState.decisions.map((dec: string, idx: number) => (
                                                    <li key={idx}>{dec}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {gsdState.blockers.length > 0 && (
                                        <div className="bg-red-50 border border-red-300 rounded p-1.5">
                                            <h4 className="text-[9px] font-black uppercase text-red-800 mb-0.5">Active Blockers</h4>
                                            <ul className="text-[9px] text-red-700 space-y-0.5 list-disc pl-3">
                                                {gsdState.blockers.map((bl: string, idx: number) => (
                                                    <li key={idx}>{bl}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}

                            {gsdActiveTab === "roadmap" && (
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-black uppercase">Milestone Roadmap</h4>
                                    <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                                        {gsdRoadmap.map((ph, idx: number) => (
                                            <div key={idx} className="border-2 border-black rounded-[4px] bg-white p-2 shadow-[2px_2px_0px_#000]">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[9px] font-black font-mono">Phase {ph.number}</span>
                                                    <span className={`text-[8px] font-black uppercase px-1 py-0.5 rounded border border-black ${
                                                        ph.status === "Complete" ? "bg-[var(--ocms-green)]" : ph.status === "In progress" ? "bg-[var(--ocms-yellow)]" : "bg-slate-100"
                                                    }`}>{ph.status}</span>
                                                </div>
                                                <div className="text-[10px] font-bold text-black mb-1">{ph.name}</div>
                                                <div className="text-[9px] text-slate-600 mb-2">{ph.description}</div>
                                                {ph.plans.length > 0 && (
                                                    <div className="space-y-1 pl-1.5 border-l-2 border-slate-200">
                                                        {ph.plans.map((pl, pIdx: number) => (
                                                            <div key={pIdx} className="flex items-center gap-1.5 text-[9px] text-slate-800">
                                                                <input type="checkbox" checked={pl.completed} readOnly className="w-2.5 h-2.5 border-black accent-black rounded" />
                                                                <span className="font-mono">{pl.id}:</span>
                                                                <span className="truncate">{pl.name}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {gsdActiveTab === "requirements" && (
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-black uppercase">Functional Scope</h4>
                                    <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                                        {Array.from(new Set(gsdRequirements.map(r => r.category))).map((cat, idx) => (
                                            <div key={idx} className="space-y-1">
                                                <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider">{cat}</div>
                                                {gsdRequirements.filter(r => r.category === cat).map((req, rIdx) => (
                                                    <div key={rIdx} className="flex items-start gap-1.5 text-[9px] text-slate-800 bg-slate-50 p-1 border border-black/5 rounded">
                                                        <input type="checkbox" checked={req.completed} readOnly className="w-2.5 h-2.5 mt-0.5 border-black accent-black rounded" />
                                                        <div>
                                                            <span className="font-bold text-black font-mono">{req.id}: </span>
                                                            <span>{req.description}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {gsdActiveTab === "actions" && (
                                <div className="space-y-3">
                                    {/* Action 1: Discuss */}
                                    <div className="space-y-1.5 border-t border-black/5 pt-2">
                                        <h5 className="text-[9px] font-black uppercase text-slate-500">1. Discuss Design Direction</h5>
                                        <textarea
                                            value={gsdMessage}
                                            onChange={(e) => setGsdMessage(e.target.value)}
                                            placeholder="Enter design preferences or phase instructions..."
                                            className="w-full text-xs bg-white border-[3px] border-black rounded-md px-2 py-1.5 text-black placeholder-slate-500 outline-none focus:shadow-[2px_2px_0px_var(--ocms-orange)]"
                                            rows={2}
                                        />
                                        <button
                                            onClick={() => runGsdAction("discuss", { message: gsdMessage })}
                                            disabled={!gsdMessage || gsdActionLoading === "discuss"}
                                            className="w-full text-[10px] bg-[var(--ocms-yellow)] border-2 border-black rounded py-1 text-black font-bold uppercase disabled:opacity-50 flex items-center justify-center gap-1.5"
                                        >
                                            {gsdActionLoading === "discuss" && <Loader2 className="w-3 h-3 animate-spin" />}
                                            Submit Preferences
                                        </button>
                                    </div>

                                    {/* Action 2: Plan */}
                                    <div className="space-y-1.5 border-t border-black/5 pt-2">
                                        <h5 className="text-[9px] font-black uppercase text-slate-500">2. Planning Phase</h5>
                                        <button
                                            onClick={() => runGsdAction("plan")}
                                            disabled={gsdActionLoading === "plan"}
                                            className="w-full text-[10px] bg-[var(--ocms-cyan)] border-2 border-black rounded py-1 text-black font-bold uppercase disabled:opacity-50 flex items-center justify-center gap-1.5"
                                        >
                                            {gsdActionLoading === "plan" && <Loader2 className="w-3 h-3 animate-spin" />}
                                            Generate Phase Spec
                                        </button>
                                    </div>

                                    {/* Action 3: Execute */}
                                    <div className="space-y-1.5 border-t border-black/5 pt-2">
                                        <h5 className="text-[9px] font-black uppercase text-slate-500">3. Execute Work</h5>
                                        <button
                                            onClick={() => runGsdAction("execute")}
                                            disabled={gsdActionLoading === "execute"}
                                            className="w-full text-[10px] bg-[var(--ocms-orange)] border-2 border-black rounded py-1 text-black font-bold uppercase disabled:opacity-50 flex items-center justify-center gap-1.5"
                                        >
                                            {gsdActionLoading === "execute" && <Loader2 className="w-3 h-3 animate-spin" />}
                                            Run AI Sub-Agents
                                        </button>
                                    </div>

                                    {/* Action 4: Verify */}
                                    <div className="space-y-1.5 border-t border-black/5 pt-2">
                                        <h5 className="text-[9px] font-black uppercase text-slate-500">4. Verification Audit</h5>
                                        <button
                                            onClick={() => runGsdAction("verify")}
                                            disabled={gsdActionLoading === "verify"}
                                            className="w-full text-[10px] bg-[var(--ocms-green)] border-2 border-black rounded py-1 text-black font-bold uppercase disabled:opacity-50 flex items-center justify-center gap-1.5"
                                        >
                                            {gsdActionLoading === "verify" && <Loader2 className="w-3 h-3 animate-spin" />}
                                            Mark Phase Verified
                                        </button>
                                    </div>

                                    {/* Action 5: Ship */}
                                    <div className="space-y-1.5 border-t border-black/5 pt-2">
                                        <h5 className="text-[9px] font-black uppercase text-slate-500">5. Ship to Production</h5>
                                        <button
                                            onClick={() => runGsdAction("ship")}
                                            disabled={gsdActionLoading === "ship"}
                                            className="w-full text-[10px] bg-indigo-500 text-white border-2 border-black rounded py-1 font-bold uppercase disabled:opacity-50 flex items-center justify-center gap-1.5"
                                        >
                                            {gsdActionLoading === "ship" && <Loader2 className="w-3 h-3 animate-spin text-white" />}
                                            Ship & Create PR
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </FeaturePanel>

                {/* ════ COLOR HARMONY GENERATOR ════ */}
                <FeaturePanel icon={<Palette className="w-3.5 h-3.5" />} title="Color Harmony Picker" tag="New" accentColor="pink">
                    <p className="text-[10px] text-slate-800 mb-2.5 font-bold">Pick a base brand color and generate a mathematical harmony palette (0% AI).</p>
                    <div className="flex gap-3 items-center mb-3">
                        <div className="flex-1 space-y-1">
                            <label className="text-[8px] font-black uppercase text-slate-700">Base Color</label>
                            <div className="flex gap-2">
                                <input type="color" value={baseColor} onChange={(e) => setBaseColor(e.target.value)}
                                    className="w-10 h-10 border-3 border-black rounded-md cursor-pointer shadow-[2px_2px_0px_#000] bg-white p-0.5" />
                                <input type="text" value={baseColor} onChange={(e) => setBaseColor(e.target.value)}
                                    className="flex-1 bg-white border-[3px] border-black rounded-md px-3 py-1.5 text-xs text-black outline-none focus:shadow-[2px_2px_0px_var(--ocms-pink)] font-mono font-bold" />
                            </div>
                        </div>
                        <div className="flex-1 space-y-1">
                            <label className="text-[8px] font-black uppercase text-slate-700">Harmony Type</label>
                            <select value={harmonyType} onChange={(e) => setHarmonyType(e.target.value as "mono" | "analogous" | "triad")}
                                className="w-full bg-white border-[3px] border-black rounded-md px-2.5 py-2 text-xs text-black outline-none focus:shadow-[2px_2px_0px_var(--ocms-pink)] font-bold">
                                <option value="mono">Monochromatic</option>
                                <option value="analogous">Analogous</option>
                                <option value="triad">Triad Harmony</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                        {currentColors.map((c, idx) => (
                            <div key={`${c}-${idx}`}
                                onClick={() => handleCopyColor(c)}
                                className="relative w-7 h-7 rounded-md border-[3px] border-black cursor-pointer hover:scale-110 transition-transform shadow-[2px_2px_0px_#000] group"
                                style={{ background: c }}
                                title={`Click to copy ${c}`}
                            >
                                {copiedColor === c ? (
                                    <>
                                        <div className="absolute inset-0 rounded-sm bg-black/25 animate-ripple" />
                                        <Check className="w-3 h-3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white animate-scale-up drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
                                    </>
                                ) : (
                                    <Clipboard className="w-2.5 h-2.5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
                                )}
                            </div>
                        ))}
                        <span className="text-[9px] text-slate-800 self-center ml-1 font-black uppercase">Current</span>
                    </div>
                    {/* Apply Colors to Live Site */}
                    <button
                        onClick={handleApplyColors}
                        disabled={isApplyingColors}
                        className={`w-full mt-3 text-xs border-[3px] border-black rounded-md py-2.5 flex items-center justify-center gap-2 font-black uppercase transition-all shadow-[3px_3px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] disabled:opacity-50 ${
                            colorApplyStatus === "success"
                                ? "bg-[var(--ocms-green)] text-black"
                                : colorApplyStatus === "error"
                                    ? "bg-[var(--ocms-orange)] text-white"
                                    : "bg-white text-black hover:bg-[var(--ocms-pink)] hover:text-white"
                        }`}
                    >
                        {isApplyingColors ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Pushing colors...</>
                        ) : colorApplyStatus === "success" ? (
                            <><Check className="w-3.5 h-3.5" /> Colors Pushed!</>
                        ) : colorApplyStatus === "error" ? (
                            <><AlertCircle className="w-3.5 h-3.5" /> Push Failed</>
                        ) : (
                            <><GitBranch className="w-3.5 h-3.5" /> Apply Palette to Site</>
                        )}
                    </button>
                    <button
                        onClick={() => setCurrentColors(["#fbbf24", "#22c55e", "#3b82f6", "#f97316", "#ec4899"])}
                        className="w-full mt-1.5 text-[9px] text-slate-600 hover:text-black font-bold uppercase tracking-wider transition-colors"
                    >
                        ↻ Reset to Defaults
                    </button>
                </FeaturePanel>

                {/* ════ GHOST CO-PILOT CURSOR ════ */}
                <FeaturePanel icon={<MousePointer2 className="w-3.5 h-3.5" />} title="Ghost Co-Pilot" tag="AI" accentColor="green">
                    <p className="text-[10px] text-slate-800 mb-2.5 font-bold">When AI edits code, a ghost cursor appears in the live preview showing what it touches.</p>
                    <div className="flex items-center gap-2.5">
                        <div className="w-3 h-3 rounded-full bg-[var(--ocms-green)] border-2 border-black animate-pulse shadow-[1px_1px_0px_#000]" />
                        <span className="text-[10px] text-black font-[family-name:var(--font-jetbrains-mono)] font-black uppercase">
                            Ghost mode: {isGhostModeActive ? "Active" : "Inactive"}
                        </span>
                        <label className="ml-auto relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={isGhostModeActive} onChange={(e) => setIsGhostModeActive(e.target.checked)} className="sr-only peer" />
                            <div className="w-10 h-6 bg-white border-[3px] border-black rounded-md transition-colors peer-checked:bg-[var(--ocms-green)] after:content-[''] after:absolute after:top-[6px] after:left-[6px] after:bg-black after:rounded-[2px] after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4" />
                        </label>
                    </div>
                </FeaturePanel>

                {/* ════ AUTO A/B TESTING SPAWNER ════ */}
                <FeaturePanel icon={<Copy className="w-3.5 h-3.5" />} title="A/B Variant Spawner" tag="AI" accentColor="blue">
                    <p className="text-[10px] text-slate-800 mb-2.5 font-bold">Generate alternate copy for a different audience and push both to GitHub.</p>
                    <select value={abTarget} onChange={(e) => setAbTarget(e.target.value)}
                        className="w-full bg-white border-[3px] border-black rounded-md px-3 py-2 text-xs text-black outline-none focus:shadow-[3px_3px_0px_var(--ocms-blue)] mb-2.5 font-[family-name:var(--font-jetbrains-mono)] font-bold">
                        <option value="gen-z">Gen Z Audience</option>
                        <option value="corporate">Corporate / B2B</option>
                        <option value="casual">Casual / Friendly</option>
                        <option value="luxury">Luxury / Premium</option>
                    </select>
                    <button onClick={handleGenerateVariant} disabled={isGeneratingVariant} className="w-full text-xs bg-[var(--ocms-blue)] border-[3px] border-black rounded-md py-2.5 text-black hover:bg-[var(--ocms-orange)] hover:text-white shadow-[3px_3px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all flex items-center justify-center gap-2 disabled:opacity-50 font-black uppercase">
                        {isGeneratingVariant ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        {isGeneratingVariant ? "Generating..." : "Generate A/B Variant"}
                    </button>
                </FeaturePanel>

                {/* ════ VOICE COMMANDS ════ */}
                <FeaturePanel icon={<Mic className="w-3.5 h-3.5" />} title="Voice Commands" tag="New" accentColor="orange">
                    <p className="text-[10px] text-slate-800 mb-2.5 font-bold">Speak a command and the CMS executes the code change.</p>
                    <button onClick={toggleVoice}
                        className={`w-full py-3 rounded-md text-xs font-black uppercase flex items-center justify-center gap-2.5 transition-all border-[3px] border-black ${isListening
                            ? "bg-[var(--ocms-orange)] text-white animate-pulse shadow-[3px_3px_0px_#000]"
                            : "bg-white text-black hover:bg-[var(--ocms-orange)] hover:text-white shadow-[3px_3px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px]"}`}>
                        {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        {isListening ? "Stop Listening" : "Start Voice Command"}
                    </button>
                    {voiceText && (
                        <div className="mt-2.5 text-[10px] text-black font-[family-name:var(--font-jetbrains-mono)] bg-[var(--ocms-green)] border-[3px] border-black rounded-md px-3 py-2 font-bold shadow-[2px_2px_0px_#000]">
                            {voiceText}
                        </div>
                    )}
                </FeaturePanel>

                {/* ════ COMPONENT STEALER ════ */}
                <FeaturePanel icon={<Wand2 className="w-3.5 h-3.5" />} title="Component Stealer" tag="AI" accentColor="pink">
                    <p className="text-[10px] text-slate-800 mb-2.5 font-bold">Paste any URL. The AI replicates the component and injects it into your workspace.</p>
                    <div className="flex gap-2">
                        <input type="text" value={componentUrl} onChange={(e) => setComponentUrl(e.target.value)}
                            className="flex-1 bg-white border-[3px] border-black rounded-md px-3 py-2 text-xs text-black placeholder-slate-500 outline-none focus:shadow-[3px_3px_0px_var(--ocms-pink)] font-[family-name:var(--font-jetbrains-mono)]"
                            placeholder="https://stripe.com" />
                        <button onClick={handleStealComponent} disabled={isStealing || !componentUrl} className="px-4 rounded-md bg-[var(--ocms-pink)] border-[3px] border-black text-black text-xs font-black uppercase hover:bg-[var(--ocms-orange)] hover:text-white shadow-[3px_3px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all disabled:opacity-50">
                            {isStealing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Steal"}
                        </button>
                    </div>
                </FeaturePanel>

                {/* ════ CODE SANDBOX ════ */}
                <FeaturePanel icon={<Code2 className="w-3.5 h-3.5" />} title="Code Sandbox" tag="Pro" accentColor="cyan">
                    <p className="text-[10px] text-slate-800 mb-2.5 font-bold">Toggle between visual controls and raw code editing.</p>
                    <div className="flex rounded-md border-[3px] border-black overflow-hidden shadow-[2px_2px_0px_#000]">
                        <button onClick={() => setShowCode(false)}
                            className={`flex-1 py-2 text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${!showCode ? "bg-[var(--ocms-blue)] text-black border-r-[3px] border-black" : "bg-white text-slate-600 hover:bg-[var(--ocms-orange)]/10 border-r-[3px] border-black"}`}>
                            <Eye className="w-3.5 h-3.5" /> Visual
                        </button>
                        <button onClick={() => setShowCode(true)}
                            className={`flex-1 py-2 text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${showCode ? "bg-[var(--ocms-green)] text-black" : "bg-white text-slate-600 hover:bg-[var(--ocms-orange)]/10"}`}>
                            <Code2 className="w-3.5 h-3.5" /> Code
                        </button>
                    </div>
                    {showCode && (
                        <div className="mt-2.5 bg-white border-[3px] border-black rounded-md p-3 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-black shadow-[3px_3px_0px_#000] leading-relaxed max-h-32 overflow-y-auto">
                            <span className="text-slate-500">{'<'}</span>
                            <span className="text-[var(--ocms-pink)] font-bold">h1</span>
                            <span className="text-slate-500">{'>'}</span>
                            {schema.find(f => f.id === "hero-title")?.value || "Welcome"}
                            <span className="text-slate-500">{'</'}</span>
                            <span className="text-[var(--ocms-pink)] font-bold">h1</span>
                            <span className="text-slate-500">{'>'}</span>
                        </div>
                    )}
                </FeaturePanel>

                {/* ════ LIGHTHOUSE SCORE PREDICTOR ════ */}
                <FeaturePanel icon={<Gauge className="w-3.5 h-3.5" />} title="Lighthouse Predictor" tag="Live" accentColor="green">
                    <p className="text-[10px] text-slate-800 mb-2.5 font-bold">Live prediction of your Google Lighthouse score before publishing.</p>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-4">
                            <div className="relative w-16 h-16">
                                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 56 56">
                                    <circle cx="28" cy="28" r="24" fill="white" stroke="black" strokeWidth="3" />
                                    <circle cx="28" cy="28" r="20" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                                    <circle cx="28" cy="28" r="20" fill="none"
                                        stroke={lighthouseScore >= 90 ? "var(--ocms-green)" : lighthouseScore >= 50 ? "var(--ocms-yellow)" : "var(--ocms-orange)"}
                                        strokeWidth="4" strokeLinecap="round"
                                        strokeDasharray={`${(lighthouseScore / 100) * 125.6} 125.6`} />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-sm font-black font-[family-name:var(--font-jetbrains-mono)] text-black">
                                    {lighthouseScore}
                                </span>
                            </div>
                            <div className="flex-1 space-y-1.5">
                                {[
                                    { label: "Performance", score: lighthouseScore, color: "var(--ocms-green)" },
                                    { label: "Accessibility", score: accessibilityScore, color: "var(--ocms-blue)" },
                                    { label: "SEO", score: seoScore, color: "var(--ocms-yellow)" },
                                ].map((m) => (
                                    <div key={m.label} className="flex items-center gap-2">
                                        <span className="text-[9px] text-slate-800 w-18 font-bold">{m.label}</span>
                                        <div className="flex-1 h-3 bg-white border-2 border-black rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all border-r-2 border-black" style={{ width: `${m.score}%`, background: m.color }} />
                                        </div>
                                        <span className="text-[9px] font-black font-[family-name:var(--font-jetbrains-mono)] w-5 text-right text-black" style={{ color: m.color }}>{m.score}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button 
                            onClick={handleRunLighthouseAudit}
                            disabled={isAuditingLighthouse}
                            className="mt-1 w-full py-2 bg-white border-[3px] border-black rounded-md text-[9px] font-black uppercase text-black hover:bg-[var(--ocms-green)] shadow-[3px_3px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                            {isAuditingLighthouse ? (
                                <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Auditing Live PageSpeed...
                                </>
                            ) : (
                                <>
                                    <Gauge className="w-3 h-3" />
                                    Audit PageSpeed (Google API)
                                </>
                            )}
                        </button>
                    </div>
                </FeaturePanel>

                {/* ════ SCROLL ANIMATIONS ════ */}
                <FeaturePanel icon={<Zap className="w-3.5 h-3.5" />} title="Scroll Animations" tag="New" accentColor="yellow">
                    <p className="text-[10px] text-slate-800 mb-2.5 font-bold">Visually connect blocks to scroll depth for entrance animations.</p>
                    <div className="space-y-2">
                        {[
                            { el: "Hero Title", trigger: "0%", anim: "Fade Up" },
                            { el: "CTA Button", trigger: "15%", anim: "Slide Right" },
                            { el: "Feature Grid", trigger: "30%", anim: "Scale In" },
                        ].map((rule) => (
                            <div key={rule.el} className="flex items-center gap-2 bg-white border-[3px] border-black rounded-md px-3 py-2 shadow-[2px_2px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_#000] transition-all">
                                <span className="text-[9px] text-black font-bold flex-1">{rule.el}</span>
                                <span className="text-[8px] font-[family-name:var(--font-jetbrains-mono)] text-black bg-[var(--ocms-blue)] px-2 py-0.5 rounded-md font-black border-2 border-black shadow-[1px_1px_0px_#000]">{rule.trigger}</span>
                                <span className="text-[8px] font-[family-name:var(--font-jetbrains-mono)] text-black bg-[var(--ocms-orange)] px-2 py-0.5 rounded-md font-black border-2 border-black shadow-[1px_1px_0px_#000]">{rule.anim}</span>
                            </div>
                        ))}
                        <button className="w-full text-xs bg-white border-[3px] border-black rounded-md py-2.5 text-black hover:bg-[var(--ocms-orange)] hover:text-white hover:shadow-[3px_3px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all flex items-center justify-center gap-1.5 font-black uppercase">
                            + Add Animation Rule
                        </button>
                    </div>
                </FeaturePanel>
            </div>

            {/* ─── Footer Action — Rainbow Glow Button ─── */}
            <div className="px-4 py-4 border-t-[3px] border-black bg-white space-y-2.5">
                {/* Build Error Details */}
                {buildStatus === "invalid" && buildErrors.length > 0 && (
                    <div className="bg-white border-[3px] border-black rounded-md p-2.5 shadow-[3px_3px_0px_#000] animate-slide-up">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 text-black" />
                            <span className="text-[9px] font-black uppercase text-black">Build Errors ({buildErrors.length})</span>
                        </div>
                        <div className="max-h-20 overflow-y-auto space-y-1">
                            {buildErrors.slice(0, 5).map((err, i) => (
                                <p key={i} className="text-[8px] text-slate-800 font-[family-name:var(--font-jetbrains-mono)] font-bold leading-tight break-all">
                                    {err}
                                </p>
                            ))}
                            {buildErrors.length > 5 && (
                                <p className="text-[8px] text-slate-600 font-bold">...and {buildErrors.length - 5} more</p>
                            )}
                        </div>
                    </div>
                )}
                {syncStatus === "error" && errorMessage && (
                    <div className="flex items-center gap-2 text-[9px] text-black font-[family-name:var(--font-jetbrains-mono)] bg-[var(--ocms-orange)] border-[3px] border-black rounded-md px-3 py-2.5 shadow-[3px_3px_0px_#000] animate-slide-up font-bold">
                        <AlertCircle className="w-4 h-4 shrink-0 text-black" />
                        <span className="truncate">{errorMessage}</span>
                    </div>
                )}
                
                <div className="flex items-center justify-between text-[9px] font-black uppercase text-slate-500 mb-2.5 px-1 select-none">
                    <span className="truncate max-w-[220px]" title={`${githubOwner}/${githubRepo}:${targetFilePath}`}>
                        Sync: {githubOwner}/{githubRepo}:{targetFilePath.split("/").pop()}
                    </span>
                    {openPermissionWizard && (
                        <button
                            type="button"
                            onClick={openPermissionWizard}
                            className="hover:text-black flex items-center gap-1 shrink-0 font-extrabold transition-colors"
                        >
                            <Settings className="w-3.5 h-3.5" /> Configure
                        </button>
                    )}
                </div>

                <button onClick={handleSaveAndSync} disabled={syncStatus === "syncing"}
                    className={`w-full py-3.5 rounded-md text-xs font-black tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2.5 border-[3px] border-black shadow-[4px_4px_0px_#000] ${syncStatus === "success"
                        ? "bg-[var(--ocms-green)] text-black"
                        : syncStatus === "error"
                            ? "bg-[var(--ocms-orange)] text-white"
                            : "bg-[var(--ocms-yellow)] text-black hover:bg-[var(--ocms-orange)] hover:text-white hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#000]"
                        } disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.97]`}>
                    {syncStatus === "syncing" ? (
                        <><Loader2 className="w-4 h-4 animate-spin text-black" /><span>Syncing changes...</span></>
                    ) : syncStatus === "success" ? (
                        <><Check className="w-4 h-4 text-black" /><span>Pushed to GitHub!</span></>
                    ) : syncStatus === "error" ? (
                        <><AlertCircle className="w-4 h-4 text-white" /><span>Sync Failed — Retry</span></>
                    ) : (
                        <><GitBranch className="w-4 h-4 text-black" /><span>Save & Sync to GitHub</span></>
                    )}
                </button>
            </div>
        </div>
    );
}
