"use client";

import { useState, useEffect } from "react";
import { X, AlertTriangle, ShieldAlert, ExternalLink, CheckCircle2, Settings } from "lucide-react";
import PermissionWizard from "./workspace/PermissionWizard";

interface EnvStatus {
    configured: boolean;
    missing: string[];
    warnings: string[];
}

const ENV_INSTRUCTIONS: Record<string, string> = {
    GITHUB_CLIENT_ID: "Required for GitHub OAuth. Register an OAuth app in GitHub Developer Settings.",
    GITHUB_CLIENT_SECRET: "Required for GitHub OAuth. Found in your GitHub OAuth app settings.",
    DATABASE_URL: "Required for data persistence. Set your PostgreSQL / database connection string.",
    NEXTAUTH_SECRET: "Required for session encryption. Generate with: openssl rand -base64 32",
};

const CRITICAL_VARS = ["DATABASE_URL", "NEXTAUTH_SECRET"];

export default function EnvHealthBanner() {
    const [status, setStatus] = useState<EnvStatus | null>(null);
    const [dismissed, setDismissed] = useState(false);
    const [showWizard, setShowWizard] = useState(false);

    useEffect(() => {
        fetch("/api/check-env")
            .then((res) => res.json())
            .then((data: EnvStatus) => setStatus(data))
            .catch(() => {
                // Silently fail — banner just won't show
            });
    }, []);

    if (!status || dismissed) return null;

    // All good — show a tiny green badge
    if (status.configured) {
        return (
            <div className="relative z-50 flex justify-center py-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-black bg-[var(--ocms-green)] px-3 py-1 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0_0_#000]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Systems OK
                </span>
            </div>
        );
    }

    const criticalMissing = status.missing.filter((v) => CRITICAL_VARS.includes(v));
    const otherMissing = status.missing.filter((v) => !CRITICAL_VARS.includes(v));

    return (
        <div className="relative z-50 w-full px-4 sm:px-6 pt-4">
            <div className="mx-auto max-w-7xl border-[3px] border-black bg-white shadow-[4px_4px_0_0_#000]">
                {/* Header bar */}
                <div className="flex items-center justify-between border-b-[3px] border-black bg-[var(--ocms-yellow)] px-4 py-3">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-black" />
                        <span className="text-sm font-black uppercase tracking-wider text-black">
                            Environment Setup Required
                        </span>
                    </div>
                    <button
                        onClick={() => setDismissed(true)}
                        className="flex h-8 w-8 items-center justify-center rounded-md border-2 border-black bg-white shadow-[2px_2px_0_0_#000] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                        aria-label="Dismiss banner"
                    >
                        <X className="w-4 h-4 text-black" />
                    </button>
                </div>

                <div className="space-y-3 p-4">
                    {/* Critical missing vars — red alerts */}
                    {criticalMissing.length > 0 && (
                        <div className="border-[3px] border-black bg-red-50 p-3 shadow-[3px_3px_0_0_#000]">
                            <div className="mb-2 flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4 text-red-700" />
                                <span className="text-xs font-black uppercase tracking-wider text-red-800">
                                    Critical — Missing
                                </span>
                            </div>
                            <ul className="space-y-2">
                                {criticalMissing.map((v) => (
                                    <li key={v} className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                                        <code className="rounded-md border-2 border-black bg-red-100 px-2 py-0.5 text-xs font-black text-red-900">
                                            {v}
                                        </code>
                                        <span className="text-xs font-semibold text-red-800">
                                            {ENV_INSTRUCTIONS[v]}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Other missing vars — orange alerts */}
                    {otherMissing.length > 0 && (
                        <div className="border-[3px] border-black bg-orange-50 p-3 shadow-[3px_3px_0_0_#000]">
                            <div className="mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-orange-700" />
                                <span className="text-xs font-black uppercase tracking-wider text-orange-800">
                                    Missing
                                </span>
                            </div>
                            <ul className="space-y-2">
                                {otherMissing.map((v) => (
                                    <li key={v} className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                                        <code className="rounded-md border-2 border-black bg-orange-100 px-2 py-0.5 text-xs font-black text-orange-900">
                                            {v}
                                        </code>
                                        <span className="text-xs font-semibold text-orange-800">
                                            {ENV_INSTRUCTIONS[v]}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Warnings — dummy / placeholder values */}
                    {status.warnings.length > 0 && (
                        <div className="border-[3px] border-black bg-yellow-50 p-3 shadow-[3px_3px_0_0_#000]">
                            <div className="mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-yellow-700" />
                                <span className="text-xs font-black uppercase tracking-wider text-yellow-800">
                                    Placeholder Values Detected
                                </span>
                            </div>
                            <ul className="space-y-2">
                                {status.warnings.map((v) => (
                                    <li key={v} className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                                        <code className="rounded-md border-2 border-black bg-yellow-100 px-2 py-0.5 text-xs font-black text-yellow-900">
                                            {v}
                                        </code>
                                        <span className="text-xs font-semibold text-yellow-800">
                                            Set to a dummy value — replace with real credentials.
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Helpful links */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:gap-4 pt-1">
                        {(status.missing.some((v) => v.startsWith("GITHUB_")) ||
                            status.warnings.some((v) => v.startsWith("GITHUB_"))) && (
                            <>
                                <button
                                    onClick={() => setShowWizard(true)}
                                    className="inline-flex items-center gap-1.5 rounded-md border-2 border-black bg-[var(--ocms-yellow)] px-3 py-1.5 text-xs font-black uppercase text-black shadow-[2px_2px_0_0_#000] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                                >
                                    <Settings className="w-3.5 h-3.5 animate-pulse" />
                                    GitHub Setup Assistant
                                </button>
                                <a
                                    href="https://github.com/settings/developers"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-md border-2 border-black bg-[var(--ocms-blue)] px-3 py-1.5 text-xs font-black uppercase text-white shadow-[2px_2px_0_0_#000] transition-all hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    Developer Settings
                                </a>
                            </>
                        )}
                    </div>
                </div>
            </div>
            
            {showWizard && (
                <PermissionWizard
                    onClose={() => setShowWizard(false)}
                />
            )}
        </div>
    );
}
