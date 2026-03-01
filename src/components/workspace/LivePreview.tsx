"use client";

import { Globe, RefreshCw, ExternalLink, AlertTriangle } from "lucide-react";
import { useState, useRef, useCallback } from "react";

interface LivePreviewProps {
    previewUrl: string;
    onUrlChange: (url: string) => void;
}

export default function LivePreview({ previewUrl, onUrlChange }: LivePreviewProps) {
    const [inputUrl, setInputUrl] = useState(previewUrl);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

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
            iframeRef.current.src = previewUrl;
        }
    }, [previewUrl]);

    return (
        <div className="flex flex-col h-full">
            {/* URL Bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--ocms-border)] bg-white/[0.02] backdrop-blur-sm">
                <Globe className="w-4 h-4 text-slate-500 shrink-0" />
                <input
                    type="text"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleNavigate()}
                    className="flex-1 bg-white/[0.03] border border-[var(--ocms-border)] rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-[var(--ocms-accent)] focus:ring-1 focus:ring-[var(--ocms-accent)]/30 transition-all font-mono"
                    placeholder="Enter website URL..."
                />
                <button
                    onClick={handleRefresh}
                    className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                    title="Refresh"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                </button>
                <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                    title="Open in new tab"
                >
                    <ExternalLink className="w-4 h-4" />
                </a>
            </div>

            {/* Iframe Container */}
            <div className="flex-1 relative bg-white">
                {isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--ocms-bg)]">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-2 border-[var(--ocms-accent)] border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs text-slate-500">Loading preview...</span>
                        </div>
                    </div>
                )}

                {hasError && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--ocms-bg)]">
                        <div className="flex flex-col items-center gap-3 text-center max-w-sm px-6">
                            <AlertTriangle className="w-10 h-10 text-amber-400" />
                            <p className="text-sm text-slate-300 font-medium">
                                This site cannot be embedded
                            </p>
                            <p className="text-xs text-slate-500">
                                The target website blocks iframe embedding (X-Frame-Options). Try using a local dev URL like <code className="text-[var(--ocms-accent)]">localhost:3001</code>.
                            </p>
                        </div>
                    </div>
                )}

                <iframe
                    ref={iframeRef}
                    src={previewUrl}
                    className="w-full h-full border-0"
                    onLoad={() => setIsLoading(false)}
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
