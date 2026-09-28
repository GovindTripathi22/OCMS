"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { AlertTriangle, ArrowRight, Home, RefreshCw, UserCheck, Settings } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import PermissionWizard from "@/components/workspace/PermissionWizard";

function AuthErrorContent() {
    const searchParams = useSearchParams();
    const error = searchParams?.get("error") || "Default";
    const [showWizard, setShowWizard] = useState(false);
    const [envInfo, setEnvInfo] = useState<{ isGuestMode: boolean; isProduction: boolean } | null>(null);

    useEffect(() => {
        fetch("/api/check-env")
            .then(res => res.json())
            .then(data => {
                setEnvInfo({
                    isGuestMode: Boolean(data.isGuestMode),
                    isProduction: Boolean(data.isProduction),
                });
            })
            .catch(() => {});
    }, []);

    const errorDetails: Record<string, { title: string; message: string; hint?: string }> = {
        Configuration: {
            title: "Authentication Configuration Notice",
            message: "There is an issue with the authentication provider configuration.",
            hint: "This typically occurs when GITHUB_CLIENT_SECRET does not match what GitHub has on file (e.g. was copied with asterisks ***** from GitHub settings), or when credentials are out of date. Generate a new Client Secret in GitHub Developer Settings and update Vercel, or click 'Continue in Guest Mode' below to edit immediately.",
        },
        AccessDenied: {
            title: "Access Denied",
            message: "You do not have permission to sign in with this account.",
            hint: "Check that your GitHub account has the required repository permissions.",
        },
        Verification: {
            title: "Verification Token Expired",
            message: "The sign-in verification link has expired or has already been used.",
            hint: "Please request a new sign-in link.",
        },
        Default: {
            title: "Authentication Error",
            message: "An unexpected error occurred during the sign-in process.",
            hint: "Please try again or use local Guest Mode.",
        },
    };

    const currentError = errorDetails[error] || errorDetails.Default;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 bg-[#f6f4ee] relative overflow-hidden">
            {/* Ambient Background Grid */}
            <div className="fixed inset-0 -z-10 bg-[#f6f4ee] overflow-hidden">
                <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                        backgroundImage: `linear-gradient(rgba(0,0,0,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,1) 1px, transparent 1px)`,
                        backgroundSize: "50px 50px",
                    }}
                />
            </div>

            <div className="w-full max-w-lg">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 mb-3">
                        <div className="relative w-10 h-10 rounded-md overflow-hidden border-2 border-black shadow-[2px_2px_0px_#000]">
                            <Image src="/ocms_logo.png" alt="OCMS Logo" fill sizes="40px" className="object-cover" />
                        </div>
                        <span className="text-xl font-black tracking-tight text-black">OCMS</span>
                    </div>
                </div>

                {/* Error Card */}
                <div className="glass-card p-6 sm:p-8 border-[3px] border-black bg-white shadow-[6px_6px_0px_#000] rounded-md space-y-6">
                    <div className="flex items-start gap-3.5 border-b-[3px] border-black pb-5 bg-[var(--ocms-yellow)] -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 p-6 rounded-t-sm">
                        <div className="p-2 border-2 border-black bg-white rounded-md shadow-[2px_2px_0px_#000] shrink-0">
                            <AlertTriangle className="w-6 h-6 text-black" />
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-xl font-black text-black uppercase tracking-tight">
                                {currentError.title}
                            </h1>
                            <p className="text-xs font-bold text-slate-900 mt-1">
                                {currentError.message}
                            </p>
                        </div>
                    </div>

                    {currentError.hint && (
                        <div className="p-4 bg-slate-50 border-2 border-black rounded-md text-xs font-semibold text-slate-800 leading-relaxed">
                            <span className="font-black text-black block mb-1 uppercase text-[11px]">Why this happened:</span>
                            {currentError.hint}
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="space-y-3 pt-2">
                        {/* Guest Mode Fallback */}
                        {envInfo?.isGuestMode && (
                            <button
                                type="button"
                                onClick={() => signIn("guest", { callbackUrl: "/workspace/new" })}
                                className="w-full py-3.5 glow-btn text-xs sm:text-sm font-black uppercase tracking-wide justify-center border-[3px] border-black bg-[var(--ocms-green)] text-black shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all flex items-center gap-2"
                            >
                                <UserCheck className="w-4 h-4" />
                                <span>Continue in Guest Mode (Offline / Local)</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        )}

                        {/* GitHub Setup Assistant */}
                        {error === "Configuration" && (
                            <button
                                type="button"
                                onClick={() => setShowWizard(true)}
                                className="w-full py-3 text-xs font-black uppercase tracking-wider border-2 border-black bg-[var(--ocms-yellow)] text-black rounded-md shadow-[2px_2px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center justify-center gap-1.5"
                            >
                                <Settings className="w-3.5 h-3.5 animate-pulse" />
                                <span>Configure GitHub OAuth App</span>
                            </button>
                        )}

                        <div className="flex gap-3">
                            <Link
                                href="/auth/signin"
                                className="flex-1 py-3 text-center text-xs font-black uppercase tracking-wide border-2 border-black bg-white shadow-[2px_2px_0px_#000] hover:bg-slate-100 rounded-md transition-all flex items-center justify-center gap-1.5"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Try Again</span>
                            </Link>
                            <Link
                                href="/"
                                className="flex-1 py-3 text-center text-xs font-black uppercase tracking-wide border-2 border-black bg-black text-white shadow-[2px_2px_0px_#000] hover:bg-slate-800 rounded-md transition-all flex items-center justify-center gap-1.5"
                            >
                                <Home className="w-3.5 h-3.5" />
                                <span>Back Home</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {showWizard && (
                <PermissionWizard onClose={() => setShowWizard(false)} />
            )}
        </div>
    );
}

export default function AuthErrorPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#f6f4ee] flex items-center justify-center font-bold">Loading...</div>}>
            <AuthErrorContent />
        </Suspense>
    );
}
