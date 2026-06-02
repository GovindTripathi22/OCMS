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
                ? "bg-[#f6f4ee]/95 backdrop-blur-xl border-b-[3px] border-black shadow-[4px_4px_0px_#000]"
                : "bg-transparent border-b-3 border-transparent"
        }`}>
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="relative w-9 h-9 rounded-md overflow-hidden border-2 border-black group-hover:shadow-[3px_3px_0px_var(--ocms-orange)] transition-all duration-300">
                        <Image src="/ocms_logo.png" alt="OCMS Logo" fill sizes="36px" className="object-cover" />
                    </div>
                    <div>
                        <span className="text-base font-black tracking-tight text-black group-hover:text-[var(--ocms-orange)] transition-colors duration-300">OCMS</span>
                        <span className="hidden sm:inline text-[10px] font-mono text-slate-700 ml-2">by SPACHT</span>
                    </div>
                </Link>

                {/* Nav Links */}
                <nav className="hidden md:flex items-center gap-1">
                    {["How it Works", "Features", "Pricing"].map((item) => (
                        <Link
                             key={item}
                             href={`#${item.toLowerCase().replace(/ /g, "-")}`}
                             className="px-4 py-2 text-sm text-slate-700 hover:text-black font-semibold transition-colors duration-200 rounded-md hover:bg-black/5"
                        >
                            {item}
                        </Link>
                    ))}
                </nav>

                {/* Actions */}
                <div className="flex items-center gap-3">
                    <Link
                        href="/api/auth/signin"
                        className="hidden sm:inline-flex text-sm text-slate-700 hover:text-black font-semibold transition-colors duration-200 px-4 py-2 rounded-md hover:bg-black/5"
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
