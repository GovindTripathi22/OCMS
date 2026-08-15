export type BuilderMode = "obsidian" | "shopify" | "studio";

export interface BuilderModeConfig {
    id: BuilderMode;
    name: string;
    tagline: string;
    icon: string;
    accentColor: string;
    badgeBg: string;
    description: string;
}

export const BUILDER_MODES: Record<BuilderMode, BuilderModeConfig> = {
    obsidian: {
        id: "obsidian",
        name: "Obsidian Builder",
        tagline: "Docs, Blogs & Digital Gardens",
        icon: "📓",
        accentColor: "var(--ocms-yellow)",
        badgeBg: "#fef08a",
        description: "Minimalist Markdown-first editor tailored for technical docs, blogs, articles, and interconnected knowledge graphs.",
    },
    shopify: {
        id: "shopify",
        name: "Shopify Builder",
        tagline: "E-Commerce & 3D Storefronts",
        icon: "🛍️",
        accentColor: "var(--ocms-green)",
        badgeBg: "#bbf7d0",
        description: "High-converting e-commerce studio tailored for product pages, pricing tables, checkout CTAs, and 3D PBR showcases.",
    },
    studio: {
        id: "studio",
        name: "Studio Pro",
        tagline: "Visual AST & Full Dev Controls",
        icon: "⚡",
        accentColor: "var(--ocms-blue)",
        badgeBg: "#bae6fd",
        description: "Comprehensive developer studio with visual AST node mapping, Lighthouse auditing, Time Travel history, and GSD orchestrator.",
    },
};
