"use client";

import { Globe, RefreshCw, ExternalLink, AlertTriangle, Loader2, Monitor } from "lucide-react";
import { useState, useCallback, RefObject, useEffect } from "react";

interface LivePreviewProps {
    previewUrl: string;
    onUrlChange: (url: string) => void;
    iframeRef: RefObject<HTMLIFrameElement>;
    onLoad?: () => void;
}

export default function LivePreview({ previewUrl, onUrlChange, iframeRef, onLoad }: LivePreviewProps) {
    const [inputUrl, setInputUrl] = useState(previewUrl);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [loadProgress, setLoadProgress] = useState(0);

    // Simulate loading progress
    useEffect(() => {
        if (!isLoading) { setLoadProgress(100); return; }
        setLoadProgress(0);
        const interval = setInterval(() => {
            setLoadProgress(p => p < 85 ? p + Math.random() * 15 : p);
        }, 300);
        return () => clearInterval(interval);
    }, [isLoading]);

    const handleNavigate = useCallback(() => {
        let url = inputUrl.trim();
        if (url && !url.startsWith("http")) {
            url = `https://${url}`;
            setInputUrl(url);
        }
        onUrlChange(url);
        setIsLoading(true);
        setHasError(false);
    }, [inputUrl, onUrlChange]);

    const handleRefresh = useCallback(() => {
        if (iframeRef.current) {
            setIsLoading(true);
            setHasError(false);
            iframeRef.current.src = `/api/proxy?url=${encodeURIComponent(previewUrl)}`;
        }
    }, [previewUrl, iframeRef]);

    return (
        <div className="flex flex-col h-full bg-[#080b14]">
            {/* URL Bar */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 sm:py-3 bg-[rgba(8,11,20,0.95)] border-b border-white/[0.06] backdrop-blur-xl">
                {/* Browser dots */}
                <div className="hidden sm:flex items-center gap-1.5 mr-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/40 border border-red-500/20" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40 border border-yellow-500/20" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/40 border border-green-500/20" />
                </div>

                <Globe className="hidden sm:block w-4 h-4 text-slate-600 shrink-0" />
                
                <div className="flex-1 relative">
                    <input
                        type="text"
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleNavigate()}
                        className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all font-mono hover:border-white/10"
                        placeholder="Enter URL to preview..."
                    />
                </div>

                <button
                    onClick={handleRefresh}
                    className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-all"
                    title="Refresh"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-violet-400" : ""}`} />
                </button>

                <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-all"
                    title="Open in new tab"
                >
                    <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <div className="hidden sm:flex items-center gap-1.5 ml-2 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.05]">
                    <Monitor className="w-3 h-3 text-slate-600" />
                    <span className="text-[9px] text-slate-600 font-mono uppercase">Preview</span>
                </div>
            </div>

            {/* Loading Progress Bar */}
            {isLoading && (
                <div className="h-0.5 bg-white/[0.03] relative overflow-hidden">
                    <div
                        className="h-full transition-all duration-300 ease-out"
                        style={{
                            width: `${loadProgress}%`,
                            background: 'linear-gradient(90deg, #8b5cf6, #22d3ee)',
                            boxShadow: '0 0 10px rgba(139,92,246,0.8)',
                        }}
                    />
                </div>
            )}

            {/* Iframe Container */}
            <div className="flex-1 relative bg-white overflow-hidden">
                {/* Loading State */}
                {isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#080b14]">
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="relative">
                                <div className="w-12 h-12 rounded-full border border-violet-500/20 flex items-center justify-center">
                                    <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                                </div>
                                {/* Pulse rings */}
                                <div className="absolute inset-0 rounded-full border border-violet-500/10 animate-ping" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-300 font-medium">Loading preview</p>
                                <p className="text-xs text-slate-600 mt-1 font-mono">{previewUrl.slice(0, 40)}...</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {hasError && !isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#080b14]">
                        <div className="flex flex-col items-center gap-4 text-center max-w-sm px-8">
                            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                <AlertTriangle className="w-6 h-6 text-amber-400" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-200 font-semibold">Can&apos;t load preview</p>
                                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                                    This site blocks embedding. Try opening it in a new tab or use a local development URL like{" "}
                                    <code className="text-violet-400 bg-violet-400/10 px-1 rounded">localhost:3001</code>
                                </p>
                            </div>
                            <button
                                onClick={handleRefresh}
                                className="text-xs text-violet-400 hover:text-violet-300 border border-violet-500/30 hover:border-violet-400/50 px-4 py-2 rounded-lg transition-all hover:bg-violet-500/5"
                            >
                                Try again
                            </button>
                        </div>
                    </div>
                )}

                <iframe
                    ref={iframeRef}
                    src={`/api/proxy?url=${encodeURIComponent(previewUrl)}`}
                    className="w-full h-full border-0"
                    onLoad={() => {
                        setIsLoading(false);
                        setLoadProgress(100);
                        onLoad?.();
                    }}
                    onError={() => {
                        setIsLoading(false);
                        setHasError(true);
                    }}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    title="Live Website Preview"
                />
            </div>
        </div>
    );
}
