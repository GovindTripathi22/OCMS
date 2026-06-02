"use client";

import { Globe, RefreshCw, ExternalLink, AlertTriangle, Loader2, Monitor, Code2 } from "lucide-react";
import { useState, useCallback, RefObject, useEffect } from "react";

interface LivePreviewProps {
    previewUrl: string;
    onUrlChange: (url: string) => void;
    iframeRef: RefObject<HTMLIFrameElement>;
    onLoad?: () => void;
    projectId?: string;
}

export default function LivePreview({ previewUrl, onUrlChange, iframeRef, onLoad, projectId }: LivePreviewProps) {
    const [inputUrl, setInputUrl] = useState(previewUrl);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [loadProgress, setLoadProgress] = useState(0);
    const [scriptMode, setScriptMode] = useState<"static" | "dynamic">("static");

    const buildProxyUrl = useCallback((targetUrl: string) => {
        const params = new URLSearchParams({ url: targetUrl, scriptMode });
        if (projectId) params.set("projectId", projectId);
        return `/api/proxy?${params.toString()}`;
    }, [projectId, scriptMode]);

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
            iframeRef.current.src = buildProxyUrl(previewUrl);
        }
    }, [previewUrl, iframeRef, buildProxyUrl]);

    useEffect(() => {
        if (!iframeRef.current) return;
        setIsLoading(true);
        setHasError(false);
        iframeRef.current.src = buildProxyUrl(previewUrl);
    }, [scriptMode, previewUrl, iframeRef, buildProxyUrl]);

    return (
        <div className="flex flex-col h-full bg-[var(--ocms-bg)]">
            {/* ─── Boxy Browser Bar ─── */}
            <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 bg-white border-b-[3px] border-black relative">
                {/* Browser dots — Poppy Colors */}
                <div className="hidden sm:flex items-center gap-2.5 mr-3">
                    <div className="w-3 h-3 rounded-[3px] border-2 border-black bg-[var(--ocms-orange)] cursor-pointer hover:-translate-y-[1px] transition-transform" />
                    <div className="w-3 h-3 rounded-[3px] border-2 border-black bg-[var(--ocms-yellow)] cursor-pointer hover:-translate-y-[1px] transition-transform" />
                    <div className="w-3 h-3 rounded-[3px] border-2 border-black bg-[var(--ocms-green)] cursor-pointer hover:-translate-y-[1px] transition-transform" />
                </div>

                <Globe className="hidden sm:block w-4 h-4 text-black shrink-0" />

                <div className="flex-1 relative">
                    <input
                        type="text"
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleNavigate()}
                        className="w-full bg-white border-[3px] border-black rounded-md px-4 py-2 text-[11px] sm:text-xs text-black placeholder-slate-500 outline-none focus:shadow-[3px_3px_0px_var(--ocms-blue)] transition-all font-mono font-bold"
                        placeholder="Enter URL to preview..."
                    />
                </div>

                <button
                    onClick={handleRefresh}
                    className="p-2 bg-white border-[3px] border-black rounded-md text-black hover:bg-[var(--ocms-orange)] hover:text-white transition-all transform active:scale-95 shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px]"
                    title="Refresh"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                </button>

                <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white border-[3px] border-black rounded-md text-black hover:bg-[var(--ocms-orange)] hover:text-white transition-all transform active:scale-95 shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px]"
                    title="Open in new tab"
                >
                    <ExternalLink className="w-4 h-4" />
                </a>

                <div className="hidden sm:flex items-center gap-1.5 ml-2 px-3 py-1 rounded-[4px] bg-[var(--ocms-green)] text-black border-2 border-black shadow-[2px_2px_0px_#000]">
                    <Monitor className="w-3 h-3 text-black" />
                    <span className="text-[8px] text-black font-extrabold uppercase tracking-wider">Live Preview</span>
                </div>

                <div className="hidden md:flex items-center rounded-md border-[3px] border-black overflow-hidden shadow-[2px_2px_0px_#000]">
                    <button
                        type="button"
                        onClick={() => setScriptMode("static")}
                        className={`px-3 py-2 text-[9px] font-black uppercase border-r-[3px] border-black transition-colors ${scriptMode === "static" ? "bg-[var(--ocms-yellow)] text-black" : "bg-white text-slate-700 hover:bg-slate-100"}`}
                        title="Static preview mode"
                    >
                        Static
                    </button>
                    <button
                        type="button"
                        onClick={() => setScriptMode("dynamic")}
                        className={`px-3 py-2 text-[9px] font-black uppercase transition-colors flex items-center gap-1 ${scriptMode === "dynamic" ? "bg-[var(--ocms-blue)] text-black" : "bg-white text-slate-700 hover:bg-slate-100"}`}
                        title="Dynamic preview mode"
                    >
                        <Code2 className="w-3 h-3" />
                        JS
                    </button>
                </div>
            </div>

            {/* ─── Loading Progress Bar — Rainbow Gradient ─── */}
            {isLoading && (
                <div className="h-1.5 bg-white border-b-2 border-black relative overflow-hidden">
                    <div
                        className="h-full transition-all duration-300 ease-out"
                        style={{
                            width: `${loadProgress}%`,
                            background: 'linear-gradient(90deg, #f97316, #fbbf24, #22c55e, #3b82f6, #ec4899)',
                        }}
                    />
                </div>
            )}

            {/* ─── Iframe Container ─── */}
            <div className="flex-1 relative bg-white overflow-hidden">
                {/* Loading State */}
                {isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--ocms-bg)]">
                        <div className="flex flex-col items-center gap-5 text-center p-8 bg-white border-[3px] border-black rounded-md shadow-[5px_5px_0px_#000]">
                            <div className="relative">
                                <div className="w-14 h-14 rounded-md border-[3px] border-black flex items-center justify-center bg-[var(--ocms-yellow)] shadow-[3px_3px_0px_#000]">
                                    <Loader2 className="w-6 h-6 text-black animate-spin" />
                                </div>
                            </div>
                            <div>
                                <p className="text-sm text-black font-extrabold uppercase tracking-wide">Loading preview</p>
                                <p className="text-xs text-slate-800 mt-1.5 font-mono font-bold break-all max-w-[250px]">{previewUrl}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {hasError && !isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--ocms-bg)]">
                        <div className="flex flex-col items-center gap-5 text-center max-w-sm p-8 bg-white border-[3px] border-black rounded-md shadow-[5px_5px_0px_#000] mx-4">
                            <div className="w-16 h-16 rounded-md bg-[var(--ocms-orange)] border-[3px] border-black flex items-center justify-center shadow-[3px_3px_0px_#000]">
                                <AlertTriangle className="w-7 h-7 text-black" />
                            </div>
                            <div>
                                <p className="text-sm text-black font-extrabold uppercase tracking-wide">Can&apos;t load preview</p>
                                <p className="text-xs text-slate-800 mt-2 leading-relaxed font-bold">
                                    This site blocks embedding. Try opening it in a new tab or use a local dev URL like{" "}
                                    <code className="text-black bg-[var(--ocms-yellow)] border border-black px-1.5 py-0.5 rounded font-mono font-extrabold">localhost:3001</code>
                                </p>
                            </div>
                            <button
                                onClick={handleRefresh}
                                className="text-xs bg-white text-black border-[3px] border-black hover:bg-[var(--ocms-orange)] hover:text-white shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] px-5 py-2.5 rounded-md transition-all font-black uppercase"
                            >
                                Try again
                            </button>
                        </div>
                    </div>
                )}

                <iframe
                    ref={iframeRef}
                    src={buildProxyUrl(previewUrl)}
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
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                    title="Live Website Preview"
                />
            </div>
        </div>
    );
}
