"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowRight, Globe, Loader2, Sparkles } from "lucide-react";

export default function NewWorkspacePage() {
    const [url, setUrl] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const router = useRouter();

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!url.trim()) return;

        setIsGenerating(true);
        // Simulate a generation/scraping delay then route to a new ID
        setTimeout(() => {
            const randomId = Math.random().toString(36).substring(2, 9);
            router.push(`/workspace/${randomId}?target=${encodeURIComponent(url)}`);
        }, 3000);
    };

    return (
        <div className="min-h-screen pt-20 flex flex-col items-center justify-center p-6 pb-32">

            {/* Animated Logo Container */}
            <div className="mb-12 animate-slide-up opacity-0 [animation-fill-mode:forwards]">
                <div className="relative w-24 h-24 border-4 border-[var(--ocms-border)] overflow-hidden group hover:border-[var(--ocms-accent)] hover:shadow-[8px_8px_0px_var(--ocms-accent-glow)] transition-all duration-300 mx-auto">
                    <Image src="/ocms_logo.png" alt="OCMS Logo" fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-center mt-6 tracking-tighter uppercase">
                    New <span className="text-[var(--ocms-accent)]">Workspace</span>
                </h1>
                <p className="text-slate-500 font-mono text-center mt-3 text-sm max-w-sm mx-auto">
                    Enter the URL of the site you want to scrape, structuralize, and inject.
                </p>
            </div>

            {/* Creation Form */}
            <div className="w-full max-w-2xl animate-slide-up opacity-0 [animation-delay:150ms] [animation-fill-mode:forwards]">
                <form onSubmit={handleCreate} className="boxy-panel p-8 md:p-12 relative overflow-hidden group/panel">
                    {/* Decorative Top Bar */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-[var(--ocms-border)] group-hover/panel:bg-[var(--ocms-accent)] transition-colors duration-300" />

                    <div className="space-y-8 relative z-10">
                        <div className="space-y-3">
                            <label className="text-xs font-mono font-bold uppercase text-slate-400 flex items-center gap-2">
                                <Globe className="w-4 h-4 text-[var(--ocms-accent)]" />
                                Target URL
                            </label>
                            <input
                                type="url"
                                required
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://example.com"
                                className="boxy-input w-full text-lg py-4 px-5 text-white placeholder-slate-600 focus:shadow-[4px_4px_0px_var(--ocms-accent)]"
                                disabled={isGenerating}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isGenerating || !url.trim()}
                            className="boxy-btn w-full py-5 text-base border-2 bg-white text-black border-white hover:bg-[var(--ocms-accent)] hover:border-[var(--ocms-accent)] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed group"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span className="animate-pulse">Scraping & Generating...</span>
                                </>
                            ) : (
                                <>
                                    <span>Initialize Workspace</span>
                                    <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </div>

                    {/* Background Graphic */}
                    <div className="absolute -bottom-24 -right-24 w-64 h-64 border border-[var(--ocms-border)] rounded-full opacity-10 blur-xl group-hover/panel:bg-[var(--ocms-accent)] group-hover/panel:opacity-5 transition-all duration-700 pointer-events-none" />
                </form>

                {/* Subtext */}
                <div className="mt-8 text-center text-xs font-mono text-slate-600 uppercase tracking-widest flex items-center justify-center gap-3">
                    <span className="w-8 h-px bg-slate-800" />
                    Powered by AI Validation
                    <span className="w-8 h-px bg-slate-800" />
                </div>
            </div>
        </div>
    );
}
