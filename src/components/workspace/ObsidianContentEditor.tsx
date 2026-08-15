"use client";

import React, { useState, useMemo } from "react";
import type { SchemaField } from "@/types/schema";
import {
    BookOpen,
    FileText,
    Sparkles,
    Hash,
    Link2,
    Code,
    CheckSquare,
    Quote,
    Copy,
    Check,
    Wand2,
    Zap,
    Share2,
    AlertCircle,
    Loader2,
    Layers,
    Tag,
} from "lucide-react";

interface ObsidianContentEditorProps {
    schema: SchemaField[];
    onFieldChange: (fieldId: string, newValue: string) => void;
    onFieldUpdate?: (fieldId: string, updates: Partial<SchemaField>) => void;
    isGhostModeActive?: boolean;
    broadcastGhostEvent?: (type: "AI_EDIT_START" | "AI_EDIT_END", selector?: string, text?: string) => void;
}

type TabType = "content" | "outline" | "graph" | "meta";

export default function ObsidianContentEditor({
    schema,
    onFieldChange,
    isGhostModeActive,
    broadcastGhostEvent,
}: ObsidianContentEditorProps) {
    const [activeTab, setActiveTab] = useState<TabType>("content");
    const [copiedMd, setCopiedMd] = useState(false);
    const [loadingAction, setLoadingAction] = useState<{ fieldId: string; action: string } | null>(null);
    const [selectedTag, setSelectedTag] = useState<string | null>(null);

    // Frontmatter Metadata State
    const [docTitle, setDocTitle] = useState("Getting Started Guide");
    const [docCategory, setDocCategory] = useState("Documentation");
    const [docTags, setDocTags] = useState("docs, guide, obsidian, nextjs");
    const [docAuthor, setDocAuthor] = useState("Core Team");

    // Text & Link Fields
    const textFields = useMemo(() => {
        return schema.filter((f) => f.type === "text" || f.type === "link");
    }, [schema]);

    // Word Count & Reading Time Calculation
    const readingStats = useMemo(() => {
        const fullText = textFields.map((f) => f.value || "").join(" ");
        const words = fullText.trim().split(/\s+/).filter(Boolean).length;
        const chars = fullText.length;
        const readTimeMinutes = Math.max(1, Math.ceil(words / 200));
        const headingsCount = textFields.filter((f) => {
            const id = (f.id || "").toLowerCase();
            const tag = (f.originalHtmlTag || "").toLowerCase();
            return tag.startsWith("h") || id.includes("title") || id.includes("head");
        }).length;

        return { words, chars, readTimeMinutes, headingsCount };
    }, [textFields]);

    // AI Inline Action Handler
    const handleAiAction = async (
        fieldId: string,
        currentValue: string,
        action: "summarize" | "change-tone" | "expand" | "fix-grammar" | "shorten",
        tone?: string
    ) => {
        if (!currentValue || !currentValue.trim()) return;
        setLoadingAction({ fieldId, action });
        try {
            const res = await fetch("/api/inline-text-action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ value: currentValue, action, tone }),
            });
            const data = await res.json();
            if (data.value) {
                onFieldChange(fieldId, data.value);
                if (isGhostModeActive && broadcastGhostEvent) {
                    const field = schema.find((f) => f.id === fieldId);
                    if (field?.selector) {
                        broadcastGhostEvent("AI_EDIT_START", field.selector, "Obsidian AI");
                        setTimeout(() => broadcastGhostEvent("AI_EDIT_END"), 1500);
                    }
                }
            }
        } catch (err) {
            console.error("Obsidian AI error:", err);
        } finally {
            setLoadingAction(null);
        }
    };

    // Quick Markdown Insert Helpers
    const handleInsertMarkdownSnippet = (fieldId: string, snippetType: string) => {
        const field = schema.find((f) => f.id === fieldId);
        if (!field) return;

        let addition = "";
        switch (snippetType) {
            case "h2":
                addition = `\n## New Section Heading\n`;
                break;
            case "callout":
                addition = `\n> [!NOTE]\n> Key takeaway or important callout for your readers.\n`;
                break;
            case "link":
                addition = ` [[Reference Note]]`;
                break;
            case "code":
                addition = `\n\`\`\`typescript\n// Code snippet\nconst setup = true;\n\`\`\`\n`;
                break;
            case "task":
                addition = `\n- [ ] Action item or checklist task\n`;
                break;
            case "quote":
                addition = `\n> "Simplicity is prerequisite for reliability." — Edsger W. Dijkstra\n`;
                break;
        }

        onFieldChange(fieldId, (field.value || "") + addition);
    };

    // Copy Complete Article as Clean Markdown
    const handleCopyAllAsMarkdown = async () => {
        const lines: string[] = [
            "---",
            `title: "${docTitle}"`,
            `category: "${docCategory}"`,
            `tags: [${docTags.split(",").map((t) => `"${t.trim()}"`).join(", ")}]`,
            `author: "${docAuthor}"`,
            `date: "${new Date().toISOString().split("T")[0]}"`,
            "---",
            "",
        ];

        textFields.forEach((field) => {
            const tag = (field.originalHtmlTag || "").toLowerCase();
            const val = field.value?.trim() || "";
            if (!val) return;

            if (tag === "h1") lines.push(`# ${val}\n`);
            else if (tag === "h2") lines.push(`## ${val}\n`);
            else if (tag === "h3") lines.push(`### ${val}\n`);
            else if (tag === "a" || field.type === "link") lines.push(`[${val}](${val.startsWith("http") ? val : "#"})\n`);
            else lines.push(`${val}\n`);
        });

        const mdContent = lines.join("\n");
        try {
            await navigator.clipboard.writeText(mdContent);
            setCopiedMd(true);
            setTimeout(() => setCopiedMd(false), 2000);
        } catch {
            console.warn("Clipboard copy failed");
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#faf9f5] select-none">
            {/* ─── Obsidian Top Banner ─── */}
            <div className="p-3 bg-[#1e1e24] text-white border-b-[3px] border-black flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-[var(--ocms-yellow)] text-black border-2 border-black rounded shadow-[2px_2px_0px_#000]">
                        <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-wider text-[var(--ocms-yellow)]">
                            Obsidian Doc Studio
                        </div>
                        <div className="text-[9px] text-slate-300 font-mono">
                            Markdown-First Knowledge & Publishing Engine
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleCopyAllAsMarkdown}
                    className="px-2.5 py-1 bg-white text-black hover:bg-[var(--ocms-yellow)] text-[9px] font-black uppercase border-2 border-black rounded shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center gap-1"
                >
                    {copiedMd ? <Check className="w-3 h-3 text-green-700" /> : <Copy className="w-3 h-3" />}
                    {copiedMd ? "Copied .md" : "Copy .md"}
                </button>
            </div>

            {/* ─── Reading Statistics Bar ─── */}
            <div className="grid grid-cols-4 gap-1 p-2 bg-white border-b-2 border-black/10 text-center font-mono text-[9px]">
                <div className="p-1.5 bg-[#f5f4ef] rounded border border-black/10">
                    <span className="block font-black text-black text-xs">{readingStats.words}</span>
                    <span className="text-slate-500 uppercase text-[7.5px] font-bold">Words</span>
                </div>
                <div className="p-1.5 bg-[#f5f4ef] rounded border border-black/10">
                    <span className="block font-black text-black text-xs">{readingStats.readTimeMinutes} min</span>
                    <span className="text-slate-500 uppercase text-[7.5px] font-bold">Read Time</span>
                </div>
                <div className="p-1.5 bg-[#f5f4ef] rounded border border-black/10">
                    <span className="block font-black text-black text-xs">{readingStats.headingsCount}</span>
                    <span className="text-slate-500 uppercase text-[7.5px] font-bold">Sections</span>
                </div>
                <div className="p-1.5 bg-[#f5f4ef] rounded border border-black/10">
                    <span className="block font-black text-black text-xs">{textFields.length}</span>
                    <span className="text-slate-500 uppercase text-[7.5px] font-bold">Nodes</span>
                </div>
            </div>

            {/* ─── Navigation Tabs ─── */}
            <div className="flex border-b-2 border-black bg-[#f1efe7] px-2 pt-1 gap-1">
                {[
                    { id: "content" as const, label: "📝 Content", icon: FileText },
                    { id: "outline" as const, label: "📑 Outline", icon: Layers },
                    { id: "graph" as const, label: "🕸️ Backlinks", icon: Share2 },
                    { id: "meta" as const, label: "🏷️ Meta", icon: Tag },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded-t-md border-t-2 border-x-2 transition-all ${
                            activeTab === tab.id
                                ? "bg-white text-black border-black -mb-[2px] pb-2 z-10 shadow-[0_-2px_0px_rgba(0,0,0,0.05)]"
                                : "bg-transparent text-slate-600 hover:text-black border-transparent"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ─── Tab Content Body ─── */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {activeTab === "content" && (
                    <div className="space-y-3">
                        {/* Quick Markdown Inserts */}
                        <div className="p-2.5 bg-white border-[2.5px] border-black rounded-md shadow-[2px_2px_0px_#000] space-y-1.5">
                            <span className="text-[9px] font-black uppercase text-black flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-[var(--ocms-yellow)]" />
                                Markdown Snippets
                            </span>
                            <div className="flex flex-wrap gap-1">
                                {[
                                    { label: "## Heading", type: "h2", icon: Hash },
                                    { label: "> Callout", type: "callout", icon: AlertCircle },
                                    { label: "[[Link]]", type: "link", icon: Link2 },
                                    { label: "```Code```", type: "code", icon: Code },
                                    { label: "- [ ] Task", type: "task", icon: CheckSquare },
                                    { label: "> Quote", type: "quote", icon: Quote },
                                ].map((item) => (
                                    <button
                                        key={item.type}
                                        type="button"
                                        onClick={() => {
                                            if (textFields[0]) {
                                                handleInsertMarkdownSnippet(textFields[0].id, item.type);
                                            }
                                        }}
                                        className="text-[8px] font-bold uppercase px-2 py-1 bg-[#faf9f5] hover:bg-[var(--ocms-yellow)] border border-black rounded shadow-[1px_1px_0px_#000] flex items-center gap-1 transition-all"
                                    >
                                        <item.icon className="w-2.5 h-2.5" />
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Editable Content Nodes */}
                        {textFields.map((field) => {
                            const isHeading =
                                field.originalHtmlTag?.startsWith("h") ||
                                field.id.toLowerCase().includes("title") ||
                                field.id.toLowerCase().includes("heading");

                            return (
                                <div
                                    key={field.id}
                                    className="p-3 bg-white border-[2.5px] border-black rounded-md shadow-[3px_3px_0px_#000] space-y-2 hover:shadow-[4px_4px_0px_var(--ocms-yellow)] transition-all"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-black uppercase text-black font-mono flex items-center gap-1">
                                            {isHeading ? "📌 " : "📄 "}
                                            {field.label || field.id}
                                        </span>
                                        <span className="text-[8px] font-mono font-bold bg-[#e2e8f0] px-1.5 py-0.5 rounded border border-black/20">
                                            {field.originalHtmlTag || field.type}
                                        </span>
                                    </div>

                                    {/* Textarea or Input */}
                                    {field.value && field.value.length > 50 ? (
                                        <textarea
                                            value={field.value}
                                            onChange={(e) => onFieldChange(field.id, e.target.value)}
                                            rows={3}
                                            className="w-full bg-[#faf9f5] border-2 border-black rounded p-2 text-xs text-black font-sans font-medium outline-none focus:shadow-[2px_2px_0px_var(--ocms-yellow)]"
                                            placeholder="Write content..."
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={field.value}
                                            onChange={(e) => onFieldChange(field.id, e.target.value)}
                                            className="w-full bg-[#faf9f5] border-2 border-black rounded px-2 py-1.5 text-xs text-black font-sans font-bold outline-none focus:shadow-[2px_2px_0px_var(--ocms-yellow)]"
                                            placeholder="Write headline..."
                                        />
                                    )}

                                    {/* AI Editorial Actions */}
                                    <div className="flex flex-wrap gap-1 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => handleAiAction(field.id, field.value, "fix-grammar")}
                                            disabled={loadingAction?.fieldId === field.id}
                                            className="text-[8px] font-black uppercase px-2 py-0.5 bg-white hover:bg-[var(--ocms-yellow)] border border-black rounded shadow-[1px_1px_0px_#000] flex items-center gap-1 transition-all disabled:opacity-50"
                                        >
                                            {loadingAction?.fieldId === field.id && loadingAction.action === "fix-grammar" ? (
                                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                            ) : (
                                                <Sparkles className="w-2.5 h-2.5 text-yellow-600" />
                                            )}
                                            Polish
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleAiAction(field.id, field.value, "summarize")}
                                            disabled={loadingAction?.fieldId === field.id}
                                            className="text-[8px] font-black uppercase px-2 py-0.5 bg-white hover:bg-[var(--ocms-blue)] border border-black rounded shadow-[1px_1px_0px_#000] flex items-center gap-1 transition-all disabled:opacity-50"
                                        >
                                            {loadingAction?.fieldId === field.id && loadingAction.action === "summarize" ? (
                                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                            ) : (
                                                <Wand2 className="w-2.5 h-2.5 text-blue-600" />
                                            )}
                                            Summarize
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleAiAction(field.id, field.value, "change-tone", "technical")}
                                            disabled={loadingAction?.fieldId === field.id}
                                            className="text-[8px] font-black uppercase px-2 py-0.5 bg-white hover:bg-[var(--ocms-green)] border border-black rounded shadow-[1px_1px_0px_#000] flex items-center gap-1 transition-all disabled:opacity-50"
                                        >
                                            {loadingAction?.fieldId === field.id && loadingAction.action === "change-tone" ? (
                                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                            ) : (
                                                <Zap className="w-2.5 h-2.5 text-green-600" />
                                            )}
                                            Technical
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {activeTab === "outline" && (
                    <div className="space-y-2">
                        <div className="text-[10px] font-black uppercase text-black">
                            📑 Document Heading Structure
                        </div>
                        <div className="bg-white border-[2.5px] border-black rounded-md p-3 shadow-[2px_2px_0px_#000] space-y-2">
                            {textFields.map((field) => {
                                const tag = field.originalHtmlTag || "p";
                                const isHead = tag.startsWith("h");
                                const level = tag === "h1" ? "pl-0" : tag === "h2" ? "pl-3" : tag === "h3" ? "pl-6" : "pl-8";

                                return (
                                    <div
                                        key={field.id}
                                        className={`flex items-start gap-2 text-xs py-1 border-b border-slate-100 last:border-0 ${level}`}
                                    >
                                        <span className={`text-[8px] font-mono px-1 py-0.5 rounded border border-black uppercase font-bold shrink-0 ${
                                            isHead ? "bg-[var(--ocms-yellow)] text-black" : "bg-slate-100 text-slate-600"
                                        }`}>
                                            {tag}
                                        </span>
                                        <span className={`truncate ${isHead ? "font-bold text-black" : "text-slate-600"}`}>
                                            {field.value || "(Empty section)"}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === "graph" && (
                    <div className="space-y-3">
                        <div className="text-[10px] font-black uppercase text-black">
                            🕸️ Connected Knowledge Graph
                        </div>
                        <div className="bg-[#1e1e24] text-white border-[2.5px] border-black rounded-md p-4 shadow-[3px_3px_0px_#000] text-center space-y-3">
                            <div className="w-12 h-12 mx-auto rounded-full bg-[var(--ocms-yellow)] text-black border-2 border-black flex items-center justify-center font-bold text-sm shadow-[2px_2px_0px_#fff]">
                                Root
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                                {docTags.split(",").map((tag, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => setSelectedTag(tag.trim())}
                                        className={`text-[8px] font-mono font-bold px-2 py-1 rounded border border-white/20 transition-all ${
                                            selectedTag === tag.trim()
                                                ? "bg-[var(--ocms-yellow)] text-black font-black"
                                                : "bg-white/10 text-white hover:bg-white/20"
                                        }`}
                                    >
                                        #{tag.trim()}
                                    </button>
                                ))}
                            </div>
                            <div className="text-[8px] text-slate-400 font-mono">
                                Interactive AST node linkages synced directly with React components.
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "meta" && (
                    <div className="space-y-3">
                        <div className="text-[10px] font-black uppercase text-black">
                            🏷️ Frontmatter & Document Metadata
                        </div>
                        <div className="bg-white border-[2.5px] border-black rounded-md p-3.5 shadow-[3px_3px_0px_#000] space-y-2.5">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase">Document Title</label>
                                <input
                                    type="text"
                                    value={docTitle}
                                    onChange={(e) => setDocTitle(e.target.value)}
                                    className="w-full bg-[#faf9f5] border-2 border-black rounded px-2.5 py-1.5 text-xs font-bold outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase">Category</label>
                                <input
                                    type="text"
                                    value={docCategory}
                                    onChange={(e) => setDocCategory(e.target.value)}
                                    className="w-full bg-[#faf9f5] border-2 border-black rounded px-2.5 py-1.5 text-xs font-bold outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase">Tags (comma separated)</label>
                                <input
                                    type="text"
                                    value={docTags}
                                    onChange={(e) => setDocTags(e.target.value)}
                                    className="w-full bg-[#faf9f5] border-2 border-black rounded px-2.5 py-1.5 text-xs font-bold outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase">Author</label>
                                <input
                                    type="text"
                                    value={docAuthor}
                                    onChange={(e) => setDocAuthor(e.target.value)}
                                    className="w-full bg-[#faf9f5] border-2 border-black rounded px-2.5 py-1.5 text-xs font-bold outline-none"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
