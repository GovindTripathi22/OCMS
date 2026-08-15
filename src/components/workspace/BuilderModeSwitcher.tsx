"use client";

import React from "react";
import type { BuilderMode } from "@/types/builder-mode";
import { BUILDER_MODES } from "@/types/builder-mode";
import { BookOpen, ShoppingBag, Zap, Sparkles } from "lucide-react";

interface BuilderModeSwitcherProps {
    currentMode: BuilderMode;
    onModeChange: (mode: BuilderMode) => void;
    compact?: boolean;
}

export default function BuilderModeSwitcher({
    currentMode,
    onModeChange,
    compact = false,
}: BuilderModeSwitcherProps) {
    return (
        <div className="w-full bg-white border-b-[3px] border-black p-2.5 select-none transition-all">
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-black flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-[var(--ocms-orange)]" />
                        Builder Workspace
                    </span>
                </div>
                <span
                    className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-black shadow-[1px_1px_0px_#000] font-mono transition-colors"
                    style={{ backgroundColor: BUILDER_MODES[currentMode].badgeBg }}
                >
                    {BUILDER_MODES[currentMode].name}
                </span>
            </div>

            {/* Seamless Mode Switcher Toggle Button */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-[#f1efe7] border-[3px] border-black rounded-lg shadow-[3px_3px_0px_#000]">
                {/* Mode A: Obsidian Content Builder */}
                <button
                    type="button"
                    onClick={() => onModeChange("obsidian")}
                    className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-md font-black uppercase text-[11px] transition-all duration-200 ${
                        currentMode === "obsidian"
                            ? "bg-[var(--ocms-yellow)] text-black border-2 border-black shadow-[2px_2px_0px_#000] -translate-x-[1px] -translate-y-[1px]"
                            : "bg-transparent text-slate-700 hover:text-black hover:bg-white/60 border-2 border-transparent"
                    }`}
                >
                    <BookOpen className="w-3 h-3 shrink-0" />
                    <span className="truncate">📓 Obsidian</span>
                </button>

                {/* Mode B: Shopify E-Commerce Builder */}
                <button
                    type="button"
                    onClick={() => onModeChange("shopify")}
                    className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-md font-black uppercase text-[11px] transition-all duration-200 ${
                        currentMode === "shopify"
                            ? "bg-[var(--ocms-green)] text-black border-2 border-black shadow-[2px_2px_0px_#000] -translate-x-[1px] -translate-y-[1px]"
                            : "bg-transparent text-slate-700 hover:text-black hover:bg-white/60 border-2 border-transparent"
                    }`}
                >
                    <ShoppingBag className="w-3 h-3 shrink-0" />
                    <span className="truncate">🛍️ Shopify</span>
                </button>

                {/* Mode C: Studio Developer Controls */}
                <button
                    type="button"
                    onClick={() => onModeChange("studio")}
                    className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-md font-black uppercase text-[11px] transition-all duration-200 ${
                        currentMode === "studio"
                            ? "bg-[var(--ocms-blue)] text-black border-2 border-black shadow-[2px_2px_0px_#000] -translate-x-[1px] -translate-y-[1px]"
                            : "bg-transparent text-slate-700 hover:text-black hover:bg-white/60 border-2 border-transparent"
                    }`}
                >
                    <Zap className="w-3 h-3 shrink-0" />
                    <span className="truncate">⚡ Studio</span>
                </button>
            </div>

            {!compact && (
                <div className="mt-2 text-[9px] text-slate-600 font-bold leading-tight flex items-center justify-between px-1">
                    <span className="truncate">{BUILDER_MODES[currentMode].tagline}</span>
                    <span className="font-mono text-[8px] uppercase text-slate-400">1-Click Mode Switch</span>
                </div>
            )}
        </div>
    );
}
