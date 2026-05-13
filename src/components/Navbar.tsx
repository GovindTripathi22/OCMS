"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handler);
        return () => window.removeEventListener("scroll", handler);
    }, []);

    return (
        <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
            scrolled
                ? "bg-[rgba(8,11,20,0.85)] backdrop-blur-xl border-b border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
                : "bg-transparent border-b border-transparent"
        }`}>
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-white/10 group-hover:border-violet-500/50 transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(139,92,246,0.3)]">
                        <Image src="/ocms_logo.png" alt="OCMS Logo" fill sizes="36px" className="object-cover" />
                    </div>
                    <div>
                        <span className="text-base font-black tracking-tight text-white group-hover:text-violet-300 transition-colors duration-300">OCMS</span>
                        <span className="hidden sm:inline text-[10px] font-mono text-slate-600 ml-2">by SPACHT</span>
                    </div>
                </Link>

                {/* Nav Links */}
                <nav className="hidden md:flex items-center gap-1">
                    {["How it Works", "Features", "Pricing"].map((item) => (
                        <Link
                            key={item}
                            href={`#${item.toLowerCase().replace(/ /g, "-")}`}
                            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors duration-200 rounded-lg hover:bg-white/[0.04]"
                        >
                            {item}
                        </Link>
                    ))}
                </nav>

                {/* Actions */}
                <div className="flex items-center gap-3">
                    <Link
                        href="/login"
                        className="hidden sm:inline-flex text-sm text-slate-400 hover:text-white transition-colors duration-200 px-4 py-2 rounded-lg hover:bg-white/[0.04]"
                    >
                        Sign In
                    </Link>
                    <Link
                        href="/workspace/new"
                        className="glow-btn text-xs sm:text-sm py-2.5 px-3 sm:px-5"
                    >
                        Launch<span className="hidden sm:inline"> App</span> <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </div>
        </header>
    );
}
