"use client";

import React, { useState } from "react";
import type { SchemaField } from "@/types/schema";
import {
    ShoppingBag,
    DollarSign,
    Tag,
    ShieldCheck,
    Box,
    Sparkles,
    Check,
    Copy,
    CreditCard,
    Flame,
} from "lucide-react";
import { PBR_PRESETS } from "@/lib/pbr-presets";
import ModelDropzone from "./ModelDropzone";
import dynamic from "next/dynamic";

const ModelViewer = dynamic(() => import("./ModelViewer"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center bg-white border-[3px] border-black rounded-md shadow-[4px_4px_0px_#000]">
            <div className="w-6 h-6 border-[3px] border-black border-t-transparent rounded-full animate-spin" />
        </div>
    ),
});

interface ShopifyStoreEditorProps {
    projectId: string;
    schema: SchemaField[];
    onFieldChange: (fieldId: string, newValue: string) => void;
    onFieldUpdate?: (fieldId: string, updates: Partial<SchemaField>) => void;
    onModelInjected: (targetFieldId: string, modelPath: string) => void;
    isGhostModeActive?: boolean;
    broadcastGhostEvent?: (type: "AI_EDIT_START" | "AI_EDIT_END", selector?: string, text?: string) => void;
}

type TabType = "product" | "3d" | "badges" | "checkout";
type StockStatusType = "in_stock" | "low_stock" | "pre_order";

export default function ShopifyStoreEditor({
    projectId,
    schema,
    onFieldChange,
    onFieldUpdate,
    onModelInjected,
}: ShopifyStoreEditorProps) {
    const [activeTab, setActiveTab] = useState<TabType>("product");

    // E-Commerce Specific States
    const [currency, setCurrency] = useState("$");
    const [productPrice, setProductPrice] = useState("79.00");
    const [originalPrice, setOriginalPrice] = useState("99.00");
    const [stockStatus, setStockStatus] = useState<StockStatusType>("in_stock");
    const [discountCode] = useState("SAVE20");
    const [copiedDiscount, setCopiedDiscount] = useState(false);

    // 3D Material States
    const [roughness, setRoughness] = useState(0.35);
    const [metalness, setMetalness] = useState(0.85);
    const [textureUrl, setTextureUrl] = useState("");

    // Trust Badges Toggle
    const [badges, setBadges] = useState<Record<string, boolean>>({
        freeShipping: true,
        moneyBack: true,
        secureCheckout: true,
        topRated: true,
    });

    const modelField = schema.find((f) => f.type === "3d-model");

    const copyDiscountCode = async () => {
        try {
            await navigator.clipboard.writeText(discountCode);
            setCopiedDiscount(true);
            setTimeout(() => setCopiedDiscount(false), 2000);
        } catch {
            console.warn("Clipboard write failed");
        }
    };

    // Apply Price & CTA change to schema fields
    const handleApplyPriceToSchema = () => {
        const priceField = schema.find(
            (f) =>
                f.id.toLowerCase().includes("price") ||
                f.value?.includes("$") ||
                f.value?.includes("€")
        );
        if (priceField) {
            onFieldChange(priceField.id, `${currency}${productPrice}`);
        }

        const ctaField = schema.find(
            (f) =>
                f.id.toLowerCase().includes("button") ||
                f.id.toLowerCase().includes("cta") ||
                f.value?.toLowerCase().includes("buy") ||
                f.value?.toLowerCase().includes("cart")
        );
        if (ctaField) {
            onFieldChange(ctaField.id, `ADD TO CART • ${currency}${productPrice}`);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] select-none">
            {/* ─── Shopify Store Header ─── */}
            <div className="p-3 bg-[#0f172a] text-white border-b-[3px] border-black flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-[var(--ocms-green)] text-black border-2 border-black rounded shadow-[2px_2px_0px_#000]">
                        <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-wider text-[var(--ocms-green)]">
                            Shopify E-Commerce Studio
                        </div>
                        <div className="text-[9px] text-slate-300 font-mono">
                            High-Converting Storefront & 3D Merch Showcase
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase bg-[var(--ocms-green)] text-black px-2 py-0.5 border-2 border-black rounded shadow-[1px_1px_0px_#000]">
                        PRO STORE
                    </span>
                </div>
            </div>

            {/* ─── Quick Store Metrics & Sale Banner ─── */}
            <div className="p-2.5 bg-[var(--ocms-green)] text-black border-b-[3px] border-black flex items-center justify-between font-mono">
                <div className="flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-red-700 animate-pulse" />
                    <span className="text-[9px] font-black uppercase">Active Promo: 20% OFF</span>
                </div>
                <button
                    type="button"
                    onClick={copyDiscountCode}
                    className="px-2 py-0.5 bg-white text-black hover:bg-black hover:text-white text-[8px] font-black uppercase border border-black rounded shadow-[1px_1px_0px_#000] flex items-center gap-1 transition-all"
                >
                    {copiedDiscount ? <Check className="w-2.5 h-2.5 text-green-600" /> : <Copy className="w-2.5 h-2.5" />}
                    {discountCode}
                </button>
            </div>

            {/* ─── Navigation Tabs ─── */}
            <div className="flex border-b-2 border-black bg-[#f1efe7] px-2 pt-1 gap-1">
                {[
                    { id: "product" as const, label: "🏷️ Catalog & Price", icon: Tag },
                    { id: "3d" as const, label: "📦 3D Showcase", icon: Box },
                    { id: "badges" as const, label: "🛡️ Trust & Badges", icon: ShieldCheck },
                    { id: "checkout" as const, label: "💳 Cart & CTA", icon: CreditCard },
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
                {activeTab === "product" && (
                    <div className="space-y-3">
                        {/* Product Pricing Matrix */}
                        <div className="p-3.5 bg-white border-[2.5px] border-black rounded-md shadow-[3px_3px_0px_#000] space-y-3">
                            <span className="text-[10px] font-black uppercase text-black flex items-center gap-1.5">
                                <DollarSign className="w-3.5 h-3.5 text-green-600" />
                                Product Pricing & Inventory
                            </span>

                            <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <label className="text-[8.5px] font-black uppercase text-slate-700">Currency</label>
                                    <select
                                        value={currency}
                                        onChange={(e) => setCurrency(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-black rounded p-1.5 text-xs font-black outline-none"
                                    >
                                        <option value="$">USD ($)</option>
                                        <option value="€">EUR (€)</option>
                                        <option value="£">GBP (£)</option>
                                        <option value="¥">JPY (¥)</option>
                                        <option value="₹">INR (₹)</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8.5px] font-black uppercase text-slate-700">Sale Price</label>
                                    <input
                                        type="text"
                                        value={productPrice}
                                        onChange={(e) => setProductPrice(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-black rounded p-1.5 text-xs font-bold font-mono outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8.5px] font-black uppercase text-slate-700">MSRP Price</label>
                                    <input
                                        type="text"
                                        value={originalPrice}
                                        onChange={(e) => setOriginalPrice(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-black rounded p-1.5 text-xs font-bold font-mono outline-none line-through text-slate-500"
                                    />
                                </div>
                            </div>

                            {/* Inventory Status Selector */}
                            <div className="space-y-1">
                                <label className="text-[8.5px] font-black uppercase text-slate-700">Inventory Status</label>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {[
                                        { id: "in_stock" as const, label: "🟢 In Stock", bg: "bg-green-100 border-green-600" },
                                        { id: "low_stock" as const, label: "⚠️ Low Stock", bg: "bg-amber-100 border-amber-600" },
                                        { id: "pre_order" as const, label: "📦 Pre-Order", bg: "bg-blue-100 border-blue-600" },
                                    ].map((st) => (
                                        <button
                                            key={st.id}
                                            type="button"
                                            onClick={() => setStockStatus(st.id)}
                                            className={`p-1.5 rounded border-2 text-[8px] font-black uppercase transition-all ${
                                                stockStatus === st.id
                                                    ? `${st.bg} border-black shadow-[2px_2px_0px_#000]`
                                                    : "bg-white border-slate-200 text-slate-600"
                                            }`}
                                        >
                                            {st.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Apply Price Button */}
                            <button
                                type="button"
                                onClick={handleApplyPriceToSchema}
                                className="w-full py-2 bg-[var(--ocms-green)] hover:bg-[var(--ocms-yellow)] text-black border-2 border-black rounded-md text-[9px] font-black uppercase shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5"
                            >
                                <Sparkles className="w-3 h-3" />
                                Sync Price to Live Page
                            </button>
                        </div>

                        {/* Storefront Fields */}
                        <div className="space-y-2">
                            <span className="text-[9px] font-black uppercase text-slate-700">
                                🛒 Scanned Storefront Elements
                            </span>
                            {schema.map((field) => (
                                <div
                                    key={field.id}
                                    className="p-3 bg-white border-[2.5px] border-black rounded-md shadow-[2px_2px_0px_#000] space-y-1.5"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-black uppercase text-black font-mono">
                                            {field.label || field.id}
                                        </span>
                                        <span className="text-[8px] font-bold uppercase bg-[var(--ocms-green)] px-1.5 py-0.5 border border-black rounded">
                                            {field.type}
                                        </span>
                                    </div>
                                    <input
                                        type="text"
                                        value={field.value}
                                        onChange={(e) => onFieldChange(field.id, e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-black rounded px-2 py-1.5 text-xs font-bold outline-none"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === "3d" && (
                    <div className="space-y-3">
                        <div className="p-3.5 bg-white border-[2.5px] border-black rounded-md shadow-[3px_3px_0px_#000] space-y-3">
                            <span className="text-[10px] font-black uppercase text-black flex items-center gap-1.5">
                                <Box className="w-3.5 h-3.5 text-orange-600" />
                                3D Product Customizer
                            </span>

                            {modelField ? (
                                <div className="h-44 border-[3px] border-black rounded-md overflow-hidden bg-slate-900 shadow-[3px_3px_0px_#000]">
                                    <ModelViewer
                                        modelPath={modelField.value}
                                        textureUrl={textureUrl}
                                        roughness={roughness}
                                        metalness={metalness}
                                    />
                                </div>
                            ) : (
                                <ModelDropzone
                                    projectId={projectId}
                                    targetFieldId="product-3d-model"
                                    onModelInjected={onModelInjected}
                                />
                            )}

                            {/* PBR Presets */}
                            <div className="space-y-1.5 pt-1">
                                <label className="text-[9px] font-black uppercase text-slate-800">
                                    PBR Material Presets
                                </label>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {PBR_PRESETS.map((preset) => (
                                        <button
                                            key={preset.name}
                                            type="button"
                                            onClick={() => {
                                                setRoughness(preset.roughness);
                                                setMetalness(preset.metalness);
                                                setTextureUrl(preset.textureUrl);
                                                if (modelField && onFieldUpdate) {
                                                    onFieldUpdate(modelField.id, {
                                                        roughness: preset.roughness,
                                                        metalness: preset.metalness,
                                                        textureUrl: preset.textureUrl,
                                                    });
                                                }
                                            }}
                                            className="flex items-center gap-2 p-1.5 border-2 border-black rounded-md bg-white hover:bg-slate-50 shadow-[2px_2px_0px_#000] text-left transition-all"
                                        >
                                            <span
                                                className="w-3.5 h-3.5 rounded-full border border-black shrink-0"
                                                style={{ backgroundColor: preset.previewColor }}
                                            />
                                            <span className="text-[8px] font-black uppercase">{preset.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "badges" && (
                    <div className="space-y-3">
                        <div className="p-3.5 bg-white border-[2.5px] border-black rounded-md shadow-[3px_3px_0px_#000] space-y-2.5">
                            <span className="text-[10px] font-black uppercase text-black flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                                Conversion Trust Badges
                            </span>

                            {[
                                { key: "freeShipping", label: "✈️ Free Worldwide Shipping (Orders $50+)" },
                                { key: "moneyBack", label: "🛡️ 30-Day 100% Money-Back Guarantee" },
                                { key: "secureCheckout", label: "🔒 256-Bit SSL Encrypted Checkout" },
                                { key: "topRated", label: "⭐ 4.9/5 Rating (1,420+ Verified Buyers)" },
                            ].map((badge) => (
                                <label
                                    key={badge.key}
                                    className="flex items-center justify-between p-2 rounded border-2 border-black bg-slate-50 cursor-pointer shadow-[1px_1px_0px_#000]"
                                >
                                    <span className="text-xs font-bold text-slate-800">{badge.label}</span>
                                    <input
                                        type="checkbox"
                                        checked={Boolean(badges[badge.key])}
                                        onChange={(e) =>
                                            setBadges((prev) => ({ ...prev, [badge.key]: e.target.checked }))
                                        }
                                        className="w-4 h-4 accent-black border-2 border-black rounded"
                                    />
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === "checkout" && (
                    <div className="space-y-3">
                        <div className="p-3.5 bg-white border-[2.5px] border-black rounded-md shadow-[3px_3px_0px_#000] space-y-3">
                            <span className="text-[10px] font-black uppercase text-black flex items-center gap-1.5">
                                <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                                Checkout Button & CTA Styling
                            </span>

                            <div className="space-y-2">
                                <button
                                    type="button"
                                    className="w-full py-3 bg-[var(--ocms-yellow)] text-black border-[3px] border-black rounded-md text-xs font-black uppercase shadow-[3px_3px_0px_#000] flex items-center justify-center gap-2"
                                >
                                    <ShoppingBag className="w-4 h-4" />
                                    ADD TO CART • {currency}{productPrice}
                                </button>
                                <button
                                    type="button"
                                    className="w-full py-2.5 bg-black text-white border-[3px] border-black rounded-md text-xs font-black uppercase shadow-[3px_3px_0px_#000] flex items-center justify-center gap-2"
                                >
                                    ⚡ BUY WITH 1-CLICK PAY
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
