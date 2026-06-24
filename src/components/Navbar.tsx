"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { ArrowRight, Menu, X } from "lucide-react";

const NAV_LINKS = ["How it Works", "Features", "Pricing"] as const;

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);

    // Scroll effect
    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handler, { passive: true });
        return () => window.removeEventListener("scroll", handler);
    }, []);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuOpen]);

    // Lock body scroll when menu is open
    useEffect(() => {
        document.body.style.overflow = menuOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [menuOpen]);

    // Close on route change (link click)
    const handleLinkClick = () => setMenuOpen(false);

    return (
        <>
            <header
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
                    scrolled || menuOpen
                        ? "bg-[#f6f4ee]/98 backdrop-blur-xl border-b-[3px] border-black shadow-[4px_4px_0px_#000]"
                        : "bg-transparent border-b-[3px] border-transparent"
                }`}
            >
                <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">

                    {/* Logo */}
                    <Link href="/" onClick={handleLinkClick} className="flex items-center gap-2.5 sm:gap-3 group shrink-0">
                        <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-md overflow-hidden border-2 border-black group-hover:shadow-[3px_3px_0px_var(--ocms-orange)] transition-all duration-300">
                            <Image src="/ocms_logo.png" alt="OCMS Logo" fill sizes="36px" className="object-cover" />
                        </div>
                        <div>
                            <span className="text-sm sm:text-base font-black tracking-tight text-black group-hover:text-[var(--ocms-orange)] transition-colors duration-300">
                                OCMS
                            </span>
                            <span className="hidden sm:inline text-[10px] font-mono text-slate-700 ml-2">by SPACHT</span>
                        </div>
                    </Link>

                    {/* Desktop nav */}
                    <nav className="hidden md:flex items-center gap-1">
                        {NAV_LINKS.map((item) => (
                            <Link
                                key={item}
                                href={`#${item.toLowerCase().replace(/ /g, "-")}`}
                                className="px-4 py-2 text-sm text-slate-700 hover:text-black font-semibold transition-colors duration-200 rounded-md hover:bg-black/5"
                            >
                                {item}
                            </Link>
                        ))}
                    </nav>

                    {/* Right side */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Sign In — desktop only */}
                        <Link
                            href="/api/auth/signin"
                            className="hidden sm:inline-flex text-sm text-slate-700 hover:text-black font-semibold transition-colors duration-200 px-4 py-2 rounded-md hover:bg-black/5"
                        >
                            Sign In
                        </Link>

                        {/* Launch button */}
                        <Link
                            href="/workspace/new"
                            onClick={handleLinkClick}
                            className="glow-btn text-xs sm:text-sm py-2 px-3 sm:py-2.5 sm:px-5 flex items-center gap-1.5"
                        >
                            Launch<span className="hidden sm:inline"> App</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </Link>

                        {/* Hamburger — mobile/tablet only */}
                        <button
                            onClick={() => setMenuOpen((o) => !o)}
                            aria-label={menuOpen ? "Close menu" : "Open menu"}
                            aria-expanded={menuOpen}
                            className="md:hidden flex items-center justify-center w-10 h-10 border-[3px] border-black rounded-md bg-white shadow-[2px_2px_0px_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
                        >
                            {menuOpen
                                ? <X className="w-4 h-4 text-black" />
                                : <Menu className="w-4 h-4 text-black" />
                            }
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile drawer overlay */}
            <div
                className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
                    menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                }`}
                aria-hidden="true"
            />

            {/* Mobile drawer */}
            <div
                ref={drawerRef}
                className={`fixed top-[57px] left-0 right-0 z-40 md:hidden transition-all duration-300 ease-out ${
                    menuOpen
                        ? "opacity-100 translate-y-0 pointer-events-auto"
                        : "opacity-0 -translate-y-4 pointer-events-none"
                }`}
            >
                <div className="mx-3 border-[3px] border-black bg-[#f6f4ee] shadow-[6px_6px_0px_#000] rounded-md overflow-hidden">
                    {/* Nav links */}
                    <nav className="p-3 space-y-1 border-b-[3px] border-black">
                        {NAV_LINKS.map((item) => (
                            <Link
                                key={item}
                                href={`#${item.toLowerCase().replace(/ /g, "-")}`}
                                onClick={handleLinkClick}
                                className="flex items-center w-full px-4 py-3 text-sm font-black uppercase tracking-wide text-black rounded-md hover:bg-black hover:text-white transition-colors duration-150 border-2 border-transparent hover:border-black"
                            >
                                {item}
                            </Link>
                        ))}
                    </nav>

                    {/* Auth + CTA */}
                    <div className="p-3 flex flex-col gap-2">
                        <Link
                            href="/api/auth/signin"
                            onClick={handleLinkClick}
                            className="w-full text-center py-3 text-sm font-black uppercase tracking-wide border-[3px] border-black rounded-md bg-white shadow-[2px_2px_0px_#000] hover:bg-[var(--ocms-yellow)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
                        >
                            Sign In
                        </Link>
                        <Link
                            href="/workspace/new"
                            onClick={handleLinkClick}
                            className="w-full text-center py-3 text-sm font-black uppercase tracking-wide border-[3px] border-black rounded-md bg-black text-white shadow-[2px_2px_0px_var(--ocms-orange)] hover:bg-[var(--ocms-orange)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center gap-2"
                        >
                            Launch App <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}
