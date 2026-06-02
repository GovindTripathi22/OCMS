"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Globe, Sparkles, Zap, Terminal } from "lucide-react";

const EXAMPLES = [
    "https://stripe.com",
    "https://vercel.com",
    "https://linear.app",
    "https://notion.so",
];

export default function NewWorkspacePage() {
    const [url, setUrl] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [step, setStep] = useState<"idle" | "scraping" | "ai" | "validating" | "saving" | "ready">("idle");
    const [logs, setLogs] = useState<string[]>([]);
    const [progress, setProgress] = useState(0);
    const router = useRouter();
    const consoleEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll the terminal logs
    useEffect(() => {
        if (consoleEndRef.current) {
            consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs]);

    const appendLog = (message: string) => {
        setLogs((prev) => [...prev, message]);
    };

    // Simulated terminal detail, anchored to the real API lifecycle in handleCreate.
    useEffect(() => {
        if (!isGenerating) {
            setLogs([]);
            setProgress(0);
            return;
        }

        const simulatedLogs = [
            { t: 80, msg: "[SYSTEM] Booting OCMS Scraper Engine v2.6..." },
            { t: 320, msg: `[SYSTEM] Target URL accepted: ${url}` },
            { t: 700, msg: "[CONNECT] Requesting remote DOM payload..." },
            { t: 1150, msg: "[DOM] Waiting for HTML stream..." },
            { t: 1650, msg: "[CLEANER] Preserving semantic text, image src, and href values..." },
            { t: 2200, msg: "[AI] Preparing selector-aware schema prompt..." },
            { t: 2850, msg: "[AI] Matching headings, CTAs, media, and content blocks..." },
            { t: 3550, msg: "[VALIDATOR] Cheerio selector validation queued..." },
            { t: 4300, msg: "[DATABASE] Preparing project workspace record..." },
        ];

        // Logs simulation
        const timers: NodeJS.Timeout[] = [];
        simulatedLogs.forEach(item => {
            const timer = setTimeout(() => {
                setLogs(prev => [...prev, item.msg]);
            }, item.t);
            timers.push(timer);
        });

        return () => {
            timers.forEach(clearTimeout);
        };
    }, [isGenerating, url]);

    useEffect(() => {
        if (!isGenerating) return;
        const progressInterval = setInterval(() => {
            setProgress(p => {
                const cap = step === "scraping" ? 42 : step === "ai" ? 78 : step === "validating" ? 90 : step === "saving" ? 97 : 99;
                if (p < cap) return p + (p < 45 ? 2 : 1);
                return p;
            });
        }, 80);

        return () => clearInterval(progressInterval);
    }, [isGenerating, step]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url.trim()) return;

        setIsGenerating(true);
        setStep("scraping");
        setProgress(6);
        appendLog("[REQUEST] Workspace initialization started from browser UI.");

        try {
            await new Promise(r => setTimeout(r, 500));
            setStep("ai");
            setProgress(44);
            appendLog("[API] POST /api/projects dispatched. Server is scraping the live site.");

            const response = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, name: "New Scraped Site" }),
            });

            if (!response.ok) throw new Error("Failed to create project");

            setStep("validating");
            setProgress(88);
            const project = await response.json();
            const fieldCount = Array.isArray(project.generatedSchema) ? project.generatedSchema.length : 0;
            appendLog(`[VALIDATOR] ${fieldCount} schema fields passed server-side selector checks.`);
            setStep("saving");
            setProgress(96);
            appendLog("[DATABASE] Project saved. Opening workspace preview bridge...");
            await new Promise(r => setTimeout(r, 450));
            setStep("ready");
            appendLog("[SUCCESS] Project registered and workspace session initiated.");
            setProgress(100);
            await new Promise(r => setTimeout(r, 200));
            router.push(`/workspace/${project.id}?target=${encodeURIComponent(url)}`);
        } catch (error) {
            console.error("Error creating project:", error);
            alert("Failed to initialize workspace. Please check the console.");
            setIsGenerating(false);
            setStep("idle");
        }
    };

    const stepMessages = {
        idle: "Initialize Workspace",
        scraping: "Scraping website...",
        ai: "AI generating schema...",
        validating: "Validating selectors...",
        saving: "Saving workspace...",
        ready: "Workspace ready!",
    };

    const loadingSteps = [
        { id: "scraping", label: "Scrape" },
        { id: "ai", label: "Schema" },
        { id: "validating", label: "Validate" },
        { id: "saving", label: "Save" },
    ] as const;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-20 relative overflow-hidden bg-[#f6f4ee]">

            {/* Ambient Background Grid */}
            <div className="fixed inset-0 -z-10 bg-[#f6f4ee] overflow-hidden">
                <div className="absolute inset-0 opacity-[0.04]"
                    style={{
                        backgroundImage: `linear-gradient(rgba(0,0,0,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,1) 1px, transparent 1px)`,
                        backgroundSize: '50px 50px',
                    }}
                />
            </div>

            {/* Top badge */}
            <div className="animate-slide-up opacity-0 [animation-fill-mode:forwards] [animation-delay:50ms] mb-10">
                <span className="feature-tag bg-[var(--ocms-yellow)] border-2 border-black shadow-[2px_2px_0px_#000] text-black">
                    <Zap className="w-3 h-3 text-black animate-bounce" />
                    New Workspace
                </span>
            </div>

            {/* Heading */}
            <div className="animate-slide-up opacity-0 [animation-fill-mode:forwards] [animation-delay:150ms] text-center mb-12">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-black mb-4">
                    Enter your
                    <span className="shimmer-text"> website URL</span>
                </h1>
                <p className="text-slate-800 text-base sm:text-lg font-bold max-w-md mx-auto">
                    We&apos;ll scrape it, generate an AI schema, and open your live editing workspace.
                </p>
            </div>

            {/* Main Interactive Card */}
            <div className="animate-slide-up opacity-0 [animation-fill-mode:forwards] [animation-delay:250ms] w-full max-w-xl">
                {isGenerating ? (
                    /* ─── AI LOADING TERMINAL CONSOLE ─── */
                    <div className="glass-card p-6 sm:p-8 border-[3px] border-black bg-black text-[#22c55e] font-mono shadow-[6px_6px_0px_#000] min-h-[380px] flex flex-col justify-between relative overflow-hidden">
                        {/* Terminal scanline CRT effect */}
                        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-gradient-to-b from-[#22c55e] via-transparent to-[#22c55e] bg-[length:100%_4px] animate-terminal-flicker" />
                        
                        {/* Terminal Header */}
                        <div className="flex items-center gap-2 pb-3 border-b-2 border-[#22c55e]/20 text-xs uppercase tracking-widest text-[#22c55e]/80">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] border border-black" />
                            <span className="w-2.5 h-2.5 rounded-full bg-[#eab308] border border-black" />
                            <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e] border border-black animate-pulse" />
                            <Terminal className="w-3.5 h-3.5 text-[#22c55e] ml-2" />
                            <span className="font-bold">OCMS Scraper CLI v2.5</span>
                            <span className="ml-auto text-[10px] text-black bg-[#22c55e] px-1.5 py-0.5 rounded font-black tracking-normal">RUNNING</span>
                        </div>

                        <div className="grid grid-cols-4 gap-2 mt-4">
                            {loadingSteps.map((item, index) => {
                                const activeIndex = loadingSteps.findIndex((candidate) => candidate.id === step);
                                const isActive = item.id === step;
                                const isComplete = activeIndex > index || step === "ready";
                                return (
                                    <div
                                        key={item.id}
                                        className={`relative border-2 border-[#22c55e]/30 rounded-md px-2 py-2 overflow-hidden transition-all duration-300 ${
                                            isActive ? "bg-[#22c55e] text-black shadow-[2px_2px_0_#22c55e]" : isComplete ? "bg-[#22c55e]/20 text-[#22c55e]" : "bg-[#07110b] text-[#22c55e]/45"
                                        }`}
                                    >
                                        {isActive && <div className="absolute inset-0 bg-white/20 animate-pulse" />}
                                        <div className="relative text-[9px] font-black uppercase tracking-wider truncate">{item.label}</div>
                                        <div className={`relative mt-1 h-1 rounded-full ${isComplete || isActive ? "bg-black/70" : "bg-[#22c55e]/20"}`} />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Terminal Console Logs */}
                        <div className="flex-1 my-4 overflow-y-auto max-h-[220px] text-[10px] sm:text-xs space-y-2 scrollbar-thin scrollbar-thumb-[#22c55e]/20 pr-2">
                            {logs.map((log, index) => {
                                let color = "text-[#22c55e]";
                                if (log.startsWith("[SUCCESS]")) color = "text-emerald-400 font-extrabold";
                                if (log.startsWith("[SYSTEM]")) color = "text-[var(--ocms-yellow)]";
                                if (log.startsWith("[AI]")) color = "text-pink-400 font-bold";
                                if (log.startsWith("[CONNECT]")) color = "text-cyan-400";
                                return (
                                    <div key={index} className={`${color} leading-relaxed animate-fade-in`}>
                                        {log}
                                    </div>
                                );
                            })}
                            <div className="flex items-center gap-1 text-[#22c55e] mt-1">
                                <span>$ {stepMessages[step]}</span>
                                <span className="w-1.5 h-3.5 bg-[#22c55e] animate-caret" />
                            </div>
                            <div ref={consoleEndRef} />
                        </div>

                        {/* Loading progress bar & Visual spinner */}
                        <div className="border-t-2 border-[#22c55e]/20 pt-4 flex items-center justify-between gap-4">
                            <div className="flex-1">
                                <div className="flex justify-between text-[10px] text-[#22c55e]/70 mb-1.5 font-bold">
                                    <span>ANALYZING PAGE SCHEMATICS</span>
                                    <span>{progress}%</span>
                                </div>
                                <div className="h-4 bg-[#0a0f18] border-2 border-black rounded-md overflow-hidden relative p-0.5 shadow-inner">
                                    <div 
                                        className="h-full bg-gradient-to-r from-[var(--ocms-orange)] via-[var(--ocms-yellow)] to-[var(--ocms-green)] border-r-2 border-black transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>

                            {/* 3D-Style Spinning Wireframe Loader */}
                            <div className="relative w-12 h-12 border-2 border-black bg-white rounded-md flex items-center justify-center shadow-[3px_3px_0_0_#22c55e] overflow-hidden group shrink-0">
                                <div className="absolute inset-0 bg-[#22c55e]/10 animate-pulse" />
                                <div className="w-6 h-6 border-[3px] border-black border-dashed rounded-md animate-spin duration-1000" />
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ─── DEFAULT CONFIGURATION FORM ─── */
                    <div className="glass-card p-6 sm:p-9 relative overflow-hidden border-[3px] border-black bg-white shadow-[6px_6px_0px_#000] hover:shadow-[8px_8px_0px_var(--ocms-orange)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all">
                        {/* Neobrutalist top border gradient */}
                        <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[var(--ocms-orange)] via-[var(--ocms-yellow)] via-[var(--ocms-green)] to-[var(--ocms-blue)]" />

                        <form onSubmit={handleCreate} className="space-y-6">
                            {/* URL input */}
                            <div className="relative">
                                <label className="block text-xs font-black text-black uppercase tracking-wider mb-2.5 flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-black" />
                                    Target URL
                                </label>
                                <div className="relative">
                                    <input
                                        type="url"
                                        required
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        placeholder="https://your-website.com"
                                        className="modern-input text-sm sm:text-base py-3.5 sm:py-4 pr-12 font-bold text-black border-[3px] border-black rounded-md shadow-[2px_2px_0px_#000] focus:shadow-[4px_4px_0px_var(--ocms-blue)] outline-none transition-all"
                                        disabled={isGenerating}
                                        autoFocus
                                    />
                                    {url && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-[var(--ocms-orange)] border border-black shadow-[1px_1px_0px_#000] animate-pulse" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={isGenerating || !url.trim()}
                                className="w-full py-4 glow-btn text-base justify-center border-[3px] border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] hover:-translate-x-[2px] hover:-translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all"
                            >
                                <Sparkles className="w-4 h-4" />
                                <span className="font-black uppercase tracking-wide">Initialize Workspace</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* Example URLs */}
            <div className="animate-fade-in opacity-0 [animation-fill-mode:forwards] [animation-delay:450ms] mt-10 text-center">
                <p className="text-[10px] text-black font-black uppercase tracking-wider mb-4">Try with Examples</p>
                <div className="flex flex-wrap gap-3.5 justify-center">
                    {EXAMPLES.map((ex) => (
                        <button
                            key={ex}
                            onClick={() => setUrl(ex)}
                            disabled={isGenerating}
                            className="text-xs text-black bg-white border-2 border-black hover:bg-[var(--ocms-yellow)] hover:shadow-[2px_2px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] rounded-md px-4 py-2 transition-all font-mono font-bold shadow-[1px_1px_0px_#000]"
                        >
                            {ex.replace("https://", "")}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
