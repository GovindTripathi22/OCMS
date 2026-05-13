"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Globe, Loader2, Sparkles, Zap } from "lucide-react";

const EXAMPLES = [
    "https://stripe.com",
    "https://vercel.com",
    "https://linear.app",
    "https://notion.so",
];

export default function NewWorkspacePage() {
    const [url, setUrl] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [step, setStep] = useState<"idle" | "scraping" | "ai" | "ready">("idle");
    const router = useRouter();

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url.trim()) return;

        setIsGenerating(true);
        setStep("scraping");

        try {
            await new Promise(r => setTimeout(r, 800));
            setStep("ai");

            const response = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, name: "New Scraped Site" }),
            });

            if (!response.ok) throw new Error("Failed to create project");

            setStep("ready");
            const project = await response.json();
            await new Promise(r => setTimeout(r, 400));
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
        ready: "Workspace ready!",
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-20 relative overflow-hidden">

            {/* Background Orbs */}
            <div className="fixed inset-0 -z-10">
                <div className="absolute inset-0 bg-[#080b14]" />
                <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full animate-orb-pulse"
                    style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)' }} />
                <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full animate-orb-pulse"
                    style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.08) 0%, transparent 70%)', animationDelay: '3s' }} />
                {/* Grid */}
                <div className="absolute inset-0 opacity-[0.025]"
                    style={{
                        backgroundImage: `linear-gradient(rgba(139,92,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,1) 1px, transparent 1px)`,
                        backgroundSize: '50px 50px',
                    }}
                />
            </div>

            {/* Top badge */}
            <div className="animate-slide-up opacity-0 [animation-fill-mode:forwards] [animation-delay:50ms] mb-10">
                <span className="feature-tag">
                    <Zap className="w-3 h-3" />
                    New Workspace
                </span>
            </div>

            {/* Heading */}
            <div className="animate-slide-up opacity-0 [animation-fill-mode:forwards] [animation-delay:150ms] text-center mb-12">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white mb-4">
                    Enter your
                    <span className="shimmer-text"> website URL</span>
                </h1>
                <p className="text-slate-500 text-lg max-w-md mx-auto">
                    We&apos;ll scrape it, generate an AI schema, and open your live editing workspace.
                </p>
            </div>

            {/* Form Card */}
            <div className="animate-slide-up opacity-0 [animation-fill-mode:forwards] [animation-delay:250ms] w-full max-w-xl">
                <div className="glass-card p-5 sm:p-8 relative overflow-hidden">
                    {/* Glow strip */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

                    <form onSubmit={handleCreate} className="space-y-5">
                        {/* URL input */}
                        <div className="relative">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Globe className="w-3.5 h-3.5 text-violet-400" />
                                Target URL
                            </label>
                            <div className="relative">
                                <input
                                    type="url"
                                    required
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://your-website.com"
                                    className="modern-input text-sm sm:text-base py-3.5 sm:py-4 pr-12"
                                    disabled={isGenerating}
                                    autoFocus
                                />
                                {url && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                        <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isGenerating || !url.trim()}
                            className="w-full py-4 glow-btn text-base justify-center disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>{stepMessages[step]}</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    <span>Initialize Workspace</span>
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>

                        {/* Progress indicator */}
                        {isGenerating && (
                            <div className="flex items-center gap-2 justify-center">
                                {["scraping", "ai", "ready"].map((s, i) => (
                                    <div key={s} className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full transition-all duration-500 ${
                                            ["scraping","ai","ready"].indexOf(step) >= i
                                                ? "bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.8)]"
                                                : "bg-white/10"
                                        }`} />
                                        {i < 2 && <div className="w-8 h-px bg-white/10" />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </form>
                </div>
            </div>

            {/* Example URLs */}
            <div className="animate-fade-in opacity-0 [animation-fill-mode:forwards] [animation-delay:450ms] mt-8 text-center">
                <p className="text-xs text-slate-600 uppercase tracking-widest mb-3">Try with</p>
                <div className="flex flex-wrap gap-2 justify-center">
                    {EXAMPLES.map((ex) => (
                        <button
                            key={ex}
                            onClick={() => setUrl(ex)}
                            disabled={isGenerating}
                            className="text-xs text-slate-500 hover:text-violet-400 border border-white/5 hover:border-violet-500/30 rounded-lg px-3 py-1.5 transition-all duration-200 hover:bg-violet-500/5 font-mono"
                        >
                            {ex.replace("https://", "")}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
