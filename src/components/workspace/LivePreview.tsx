"use client";

import {
    Globe, RefreshCw, ExternalLink, AlertTriangle,
    Loader2, Monitor, Code2, ChevronRight,
} from "lucide-react";
import { useState, useCallback, RefObject, useEffect, useRef } from "react";

interface LivePreviewProps {
    previewUrl: string;
    onUrlChange: (url: string) => void;
    iframeRef: RefObject<HTMLIFrameElement>;
    onLoad?: () => void;
    projectId?: string;
}

export default function LivePreview({
    previewUrl,
    onUrlChange,
    iframeRef,
    onLoad,
    projectId,
}: LivePreviewProps) {
    const [inputUrl, setInputUrl] = useState(previewUrl);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [loadProgress, setLoadProgress] = useState(0);
    const [scriptMode, setScriptMode] = useState<"static" | "dynamic">("static");
    const [isInspecting, setIsInspecting] = useState(false);

    // Sync inspection state to the preview iframe
    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe?.contentWindow) return;
        iframe.contentWindow.postMessage({
            source: 'ocms-parent',
            action: 'toggle-inspector',
            enabled: isInspecting
        }, '*');
    }, [isInspecting, iframeRef, previewUrl, isLoading]);

    // Mobile: whether the URL bar is expanded
    const [urlBarExpanded, setUrlBarExpanded] = useState(false);
    const urlInputRef = useRef<HTMLInputElement>(null);

    const buildProxyUrl = useCallback((targetUrl: string) => {
        const params = new URLSearchParams({ url: targetUrl, scriptMode });
        if (projectId) params.set("projectId", projectId);
        return `/api/proxy?${params.toString()}`;
    }, [projectId, scriptMode]);

    // Load progress animation
    useEffect(() => {
        if (!isLoading) { setLoadProgress(100); return; }
        setLoadProgress(0);
        const interval = setInterval(() => {
            setLoadProgress((p) => (p < 85 ? p + Math.random() * 15 : p));
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
        setUrlBarExpanded(false);
    }, [inputUrl, onUrlChange]);

    const handleRefresh = useCallback(() => {
        if (iframeRef.current) {
            setIsLoading(true);
            setHasError(false);
            iframeRef.current.src = buildProxyUrl(previewUrl);
        }
    }, [previewUrl, iframeRef, buildProxyUrl]);

    // Re-load iframe when scriptMode or previewUrl changes
    useEffect(() => {
        if (!iframeRef.current) return;
        setIsLoading(true);
        setHasError(false);
        iframeRef.current.src = buildProxyUrl(previewUrl);
    }, [scriptMode, previewUrl, iframeRef, buildProxyUrl]);

    // Auto-focus URL input when expanded on mobile
    useEffect(() => {
        if (urlBarExpanded && urlInputRef.current) {
            urlInputRef.current.focus();
            urlInputRef.current.select();
        }
    }, [urlBarExpanded]);

    // Friendly display URL (strip protocol for the badge)
    const displayUrl = previewUrl
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "")
        .slice(0, 28);

    return (
        <div className="flex flex-col h-full bg-[var(--ocms-bg)]">

            {/* ── Toolbar ── */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 bg-white border-b-[3px] border-black">

                {/* Traffic lights — desktop only */}
                <div className="hidden sm:flex items-center gap-2 mr-1 shrink-0">
                    <div className="w-3 h-3 rounded-[3px] border-2 border-black bg-[var(--ocms-orange)]" />
                    <div className="w-3 h-3 rounded-[3px] border-2 border-black bg-[var(--ocms-yellow)]" />
                    <div className="w-3 h-3 rounded-[3px] border-2 border-black bg-[var(--ocms-green)]" />
                </div>

                {/* Globe icon — desktop */}
                <Globe className="hidden sm:block w-4 h-4 text-black shrink-0" />

                {/* ── URL Bar ── */}
                {/* Mobile: compact badge that expands on tap */}
                <div className="flex-1 min-w-0 sm:hidden">
                    {urlBarExpanded ? (
                        <div className="flex items-center gap-1.5">
                            <input
                                ref={urlInputRef}
                                type="url"
                                inputMode="url"
                                value={inputUrl}
                                onChange={(e) => setInputUrl(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleNavigate();
                                    if (e.key === "Escape") setUrlBarExpanded(false);
                                }}
                                className="flex-1 min-w-0 bg-white border-[3px] border-black rounded-md px-3 py-2 text-xs text-black outline-none focus:shadow-[3px_3px_0px_var(--ocms-blue)] font-mono font-bold"
                                placeholder="https://..."
                            />
                            <button
                                onClick={handleNavigate}
                                className="shrink-0 px-3 py-2 bg-[var(--ocms-blue)] border-[3px] border-black rounded-md text-black text-xs font-black shadow-[2px_2px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                            >
                                Go
                            </button>
                            <button
                                onClick={() => setUrlBarExpanded(false)}
                                className="shrink-0 p-2 border-[3px] border-black rounded-md bg-white text-black active:bg-slate-100 transition-colors"
                            >
                                <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setUrlBarExpanded(true)}
                            className="flex items-center gap-1.5 w-full px-3 py-2 bg-white border-[3px] border-black rounded-md text-left"
                        >
                            <Globe className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="text-[10px] font-mono font-bold text-black truncate flex-1">
                                {displayUrl || "Enter URL..."}
                            </span>
                            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                        </button>
                    )}
                </div>

                {/* Desktop URL bar — always visible */}
                <div className="hidden sm:flex flex-1 min-w-0">
                    <input
                        type="text"
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleNavigate()}
                        className="w-full bg-white border-[3px] border-black rounded-md px-4 py-2 text-xs text-black placeholder-slate-500 outline-none focus:shadow-[3px_3px_0px_var(--ocms-blue)] transition-all font-mono font-bold"
                        placeholder="Enter URL to preview..."
                    />
                </div>

                {/* Refresh */}
                <button
                    onClick={handleRefresh}
                    className="shrink-0 p-2 sm:p-2.5 bg-white border-[3px] border-black rounded-md text-black hover:bg-[var(--ocms-orange)] hover:text-white active:scale-95 shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all touch-manipulation"
                    title="Refresh"
                >
                    <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLoading ? "animate-spin" : ""}`} />
                </button>

                {/* Open in new tab */}
                <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 p-2 sm:p-2.5 bg-white border-[3px] border-black rounded-md text-black hover:bg-[var(--ocms-orange)] hover:text-white active:scale-95 shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all touch-manipulation"
                    title="Open in new tab"
                >
                    <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </a>

                {/* Live badge — hidden on mobile to save space */}
                <div className="hidden lg:flex items-center gap-1.5 ml-1 px-3 py-1 rounded-[4px] bg-[var(--ocms-green)] text-black border-2 border-black shadow-[2px_2px_0px_#000] shrink-0">
                    <Monitor className="w-3 h-3 text-black" />
                    <span className="text-[8px] text-black font-extrabold uppercase tracking-wider whitespace-nowrap">Live Preview</span>
                </div>

                {/* Visual Inspect Button */}
                <button
                    type="button"
                    onClick={() => setIsInspecting((prev) => !prev)}
                    className={`shrink-0 p-2 sm:p-2.5 border-[3px] border-black rounded-md font-black uppercase text-xs flex items-center gap-1.5 shadow-[2px_2px_0px_#000] active:scale-95 transition-all touch-manipulation ${
                        isInspecting
                            ? "bg-[var(--ocms-orange)] text-white shadow-[1px_1px_0px_#000] translate-x-[1px] translate-y-[1px]"
                            : "bg-white text-black hover:bg-[var(--ocms-yellow)]"
                    }`}
                    title="Visual Inspect Mode (Click to Add Fields)"
                >
                    <span className="w-3.5 h-3.5 flex items-center justify-center font-bold">🎯</span>
                    <span className="hidden lg:inline text-[10px]">Inspect</span>
                </button>

                {/* Static / JS toggle */}
                {/* Mobile: icon-only; Tablet+: labeled */}
                <div className="hidden sm:flex shrink-0 items-center rounded-md border-[3px] border-black overflow-hidden shadow-[2px_2px_0px_#000]">
                    <button
                        type="button"
                        onClick={() => setScriptMode("static")}
                        className={`px-2 sm:px-3 py-2 text-[9px] font-black uppercase border-r-[3px] border-black transition-colors touch-manipulation ${
                            scriptMode === "static" ? "bg-[var(--ocms-yellow)] text-black" : "bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                        title="Static mode"
                    >
                        <span className="hidden md:inline">Static</span>
                        <span className="md:hidden text-[8px]">S</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setScriptMode("dynamic")}
                        className={`px-2 sm:px-3 py-2 text-[9px] font-black uppercase transition-colors flex items-center gap-1 touch-manipulation ${
                            scriptMode === "dynamic" ? "bg-[var(--ocms-blue)] text-black" : "bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                        title="Dynamic JS mode"
                    >
                        <Code2 className="w-3 h-3" />
                        <span className="hidden md:inline">JS</span>
                    </button>
                </div>

                {/* Mobile Static/JS — icon toggle */}
                <button
                    type="button"
                    onClick={() => setScriptMode((m) => m === "static" ? "dynamic" : "static")}
                    className={`sm:hidden shrink-0 p-2 border-[3px] border-black rounded-md shadow-[2px_2px_0px_#000] transition-all touch-manipulation ${
                        scriptMode === "dynamic" ? "bg-[var(--ocms-blue)]" : "bg-white"
                    }`}
                    title={scriptMode === "static" ? "Switch to Dynamic JS" : "Switch to Static"}
                >
                    <Code2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Progress bar */}
            {isLoading && (
                <div className="h-1 sm:h-1.5 bg-white border-b-2 border-black relative overflow-hidden">
                    <div
                        className="h-full transition-all duration-300 ease-out"
                        style={{
                            width: `${loadProgress}%`,
                            background: "linear-gradient(90deg, #f97316, #fbbf24, #22c55e, #3b82f6, #ec4899)",
                        }}
                    />
                </div>
            )}

            {/* Preview area */}
            <div className="flex-1 relative bg-white overflow-hidden min-h-0">
                {/* Loading state */}
                {isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--ocms-bg)]">
                        <div className="flex flex-col items-center gap-4 text-center p-6 sm:p-8 bg-white border-[3px] border-black rounded-md shadow-[5px_5px_0px_#000] max-w-xs mx-4">
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-md border-[3px] border-black flex items-center justify-center bg-[var(--ocms-yellow)] shadow-[3px_3px_0px_#000]">
                                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-black animate-spin" />
                            </div>
                            <div>
                                <p className="text-xs sm:text-sm text-black font-extrabold uppercase tracking-wide">Loading preview</p>
                                <p className="text-[10px] sm:text-xs text-slate-800 mt-1.5 font-mono font-bold break-all max-w-[220px] line-clamp-2">
                                    {previewUrl}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error state */}
                {hasError && !isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--ocms-bg)]">
                        <div className="flex flex-col items-center gap-4 text-center max-w-xs p-6 sm:p-8 bg-white border-[3px] border-black rounded-md shadow-[5px_5px_0px_#000] mx-4">
                            <div className="w-14 h-14 rounded-md bg-[var(--ocms-orange)] border-[3px] border-black flex items-center justify-center shadow-[3px_3px_0px_#000]">
                                <AlertTriangle className="w-6 h-6 text-black" />
                            </div>
                            <div>
                                <p className="text-sm text-black font-extrabold uppercase tracking-wide">Can&apos;t load preview</p>
                                <p className="text-xs text-slate-800 mt-2 leading-relaxed font-bold">
                                    This site blocks embedding. Try opening it in a new tab or use a local URL like{" "}
                                    <code className="text-black bg-[var(--ocms-yellow)] border border-black px-1.5 py-0.5 rounded font-mono font-extrabold text-[10px]">
                                        localhost:3001
                                    </code>
                                </p>
                            </div>
                            <div className="flex gap-2 w-full">
                                <button
                                    onClick={handleRefresh}
                                    className="flex-1 text-xs bg-white text-black border-[3px] border-black hover:bg-[var(--ocms-orange)] hover:text-white shadow-[3px_3px_0px_#000] px-4 py-2.5 rounded-md transition-all font-black uppercase touch-manipulation"
                                >
                                    Retry
                                </button>
                                <a
                                    href={previewUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 text-xs bg-black text-white border-[3px] border-black shadow-[3px_3px_0px_#000] px-4 py-2.5 rounded-md font-black uppercase text-center flex items-center justify-center gap-1 touch-manipulation"
                                >
                                    Open <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
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
