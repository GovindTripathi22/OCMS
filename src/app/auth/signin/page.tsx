"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { ArrowRight, Github, UserCheck, ShieldAlert, Home, Settings } from "lucide-react";
import PermissionWizard from "@/components/workspace/PermissionWizard";

function SignInContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { data: session, status } = useSession();
    const callbackUrl = searchParams?.get("callbackUrl") || "/workspace/new";
    const errorParam = searchParams?.get("error");

    const [envInfo, setEnvInfo] = useState<{
        isGuestMode: boolean;
        isProduction: boolean;
        githubConfigured: boolean;
        secretHasAsterisks?: boolean;
        clientIdHasAsterisks?: boolean;
        callbackUrl?: string;
        homepageUrl?: string;
    } | null>(null);
    const [loading, setLoading] = useState(false);
    const [showWizard, setShowWizard] = useState(false);

    useEffect(() => {
        fetch("/api/check-env")
            .then((res) => res.json())
            .then((data) => {
                setEnvInfo({
                    isGuestMode: Boolean(data.isGuestMode),
                    isProduction: Boolean(data.isProduction),
                    githubConfigured: Boolean(data.githubConfigured),
                    secretHasAsterisks: Boolean(data.secretHasAsterisks),
                    clientIdHasAsterisks: Boolean(data.clientIdHasAsterisks),
                    callbackUrl: data.callbackUrl,
                    homepageUrl: data.homepageUrl,
                });
            })
            .catch(() => {});
    }, []);

    // If already authenticated, redirect to callbackUrl
    useEffect(() => {
        if (status === "authenticated" && session?.user) {
            router.push(callbackUrl);
        }
    }, [status, session, router, callbackUrl]);

    const handleGuestSignIn = async () => {
        setLoading(true);
        try {
            await signIn("guest", { callbackUrl });
        } catch (err) {
            console.error("Guest sign-in error:", err);
            setLoading(false);
        }
    };

    const handleGithubSignIn = async () => {
        setLoading(true);
        try {
            await signIn("github", { callbackUrl });
        } catch (err) {
            console.error("GitHub sign-in error:", err);
            setLoading(false);
        }
    };

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

            {/* Card Container */}
            <div className="w-full max-w-md">
                {/* Logo & Heading */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 mb-4">
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden border-2 border-black shadow-[3px_3px_0px_#000]">
                            <Image src="/ocms_logo.png" alt="OCMS Logo" fill sizes="48px" className="object-cover" />
                        </div>
                        <span className="text-2xl font-black tracking-tight text-black">OCMS</span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-black mb-2">Welcome to OCMS</h1>
                    <p className="text-sm font-bold text-slate-700">
                        Choose your sign-in method to start editing.
                    </p>
                </div>

                {/* Error Banner if redirected from an error */}
                {(errorParam || envInfo?.secretHasAsterisks) && (
                    <div className="mb-6 p-4 border-[3px] border-black bg-[var(--ocms-yellow)] shadow-[4px_4px_0_0_#000] rounded-md text-xs font-bold text-black flex items-start gap-2.5">
                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-black uppercase block mb-0.5">Authentication Notice</span>
                            {envInfo?.secretHasAsterisks
                                ? "GITHUB_CLIENT_SECRET appears to contain asterisks (*****). Generate a new Client Secret in GitHub Developer Settings and copy the raw value into Vercel, or click Guest Mode below."
                                : errorParam === "Configuration"
                                ? "GitHub OAuth configuration issue detected. You can configure GitHub settings or continue instantly in Guest Mode below."
                                : "An authentication error occurred. Please try again or continue as Guest."}
                        </div>
                    </div>
                )}

                {/* Main Auth Card */}
                <div className="glass-card p-6 sm:p-8 border-[3px] border-black bg-white shadow-[6px_6px_0px_#000] rounded-md space-y-5">
                    {/* Guest Mode Option (Offline / Local Dev) */}
                    {envInfo?.isGuestMode && (
                        <div>
                            <button
                                type="button"
                                onClick={handleGuestSignIn}
                                disabled={loading}
                                className="w-full py-4 glow-btn text-sm font-black uppercase tracking-wide justify-center border-[3px] border-black bg-[var(--ocms-green)] text-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] hover:-translate-x-[2px] hover:-translate-y-[2px] transition-all flex items-center gap-2"
                            >
                                <UserCheck className="w-4 h-4" />
                                <span>Continue as Guest (Instant Access)</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                            <p className="text-[11px] font-bold text-slate-600 mt-2 text-center">
                                Instant access to visual editor. No GitHub credentials required.
                            </p>
                        </div>
                    )}

                    {envInfo?.isGuestMode && (
                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t-2 border-black/15" />
                            <span className="flex-shrink mx-3 text-xs font-black uppercase text-slate-500">OR</span>
                            <div className="flex-grow border-t-2 border-black/15" />
                        </div>
                    )}

                    {/* GitHub Sign-In */}
                    {envInfo?.githubConfigured ? (
                        <div>
                            <button
                                type="button"
                                onClick={handleGithubSignIn}
                                disabled={loading}
                                className="w-full py-3.5 text-sm font-black uppercase tracking-wide justify-center border-[3px] border-black bg-black text-white shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] hover:bg-slate-800 hover:-translate-x-[2px] hover:-translate-y-[2px] transition-all flex items-center gap-2.5 rounded-md"
                            >
                                <Github className="w-4 h-4" />
                                <span>Sign In with GitHub</span>
                            </button>
                            <p className="text-[11px] font-bold text-slate-600 mt-2 text-center">
                                Connect repository to enable two-way sync and PR publishing.
                            </p>
                        </div>
                    ) : (
                        <div className="p-4 border-2 border-dashed border-black/40 rounded-md bg-slate-50 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase">
                                <ShieldAlert className="w-4 h-4 text-amber-600" />
                                <span>GitHub OAuth Not Configured</span>
                            </div>
                            <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                                To sync changes with remote GitHub repositories, add your <code className="bg-white border px-1 py-0.5 rounded font-mono font-bold">GITHUB_CLIENT_ID</code> and <code className="bg-white border px-1 py-0.5 rounded font-mono font-bold">GITHUB_CLIENT_SECRET</code> to <code className="bg-white border px-1 py-0.5 rounded font-mono font-bold">.env.local</code>.
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowWizard(true)}
                                className="w-full py-2 text-xs font-black uppercase tracking-wider border-2 border-black bg-[var(--ocms-yellow)] text-black rounded-md shadow-[2px_2px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center justify-center gap-1.5"
                            >
                                <Settings className="w-3.5 h-3.5 animate-pulse" />
                                GitHub Setup Assistant
                            </button>
                        </div>
                    )}
                </div>

                {/* Back to Home Link */}
                <div className="mt-8 text-center">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-black transition-colors"
                    >
                        <Home className="w-3.5 h-3.5" />
                        <span>Return to Home</span>
                    </Link>
                </div>
            </div>

            {/* GitHub Setup Wizard Modal */}
            {showWizard && (
                <PermissionWizard onClose={() => setShowWizard(false)} />
            )}
        </div>
    );
}

export default function SignInPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#f6f4ee] flex items-center justify-center font-bold">Loading...</div>}>
            <SignInContent />
        </Suspense>
    );
}
