import Link from "next/link";
import Image from "next/image";

export default function Navbar() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-[var(--ocms-bg)]/95 backdrop-blur-sm border-b-2 border-[var(--ocms-border)]">
            <Link href="/" className="flex items-center gap-4 group">
                <div className="relative w-12 h-12 border-2 border-[var(--ocms-border)] overflow-hidden transition-transform duration-300 group-hover:scale-105 group-hover:border-[var(--ocms-accent)] group-hover:shadow-[4px_4px_0px_var(--ocms-accent-glow)]">
                    <Image src="/ocms_logo.png" alt="OCMS Logo" fill className="object-cover" />
                </div>
                <div className="flex flex-col justify-center">
                    <span className="text-xl font-black tracking-tight leading-none text-white uppercase group-hover:text-[var(--ocms-accent)] transition-colors duration-300">OCMS</span>
                    <span className="text-[10px] font-mono text-[var(--ocms-accent)] uppercase tracking-[0.2em] leading-none mt-1">By SPACHT</span>
                </div>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
                <Link href="#how-it-works" className="text-xs font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-wider">How it Works</Link>
                <Link href="#features" className="text-xs font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-wider">Features</Link>
                <Link href="#pricing" className="text-xs font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-wider">Pricing</Link>
            </nav>

            <div className="flex items-center gap-3">
                <Link
                    href="/login"
                    className="text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider"
                >
                    Sign In
                </Link>
                <Link
                    href="/workspace/new"
                    className="boxy-btn text-xs py-2 px-4 bg-[var(--ocms-accent)] text-white border-[var(--ocms-accent)]"
                >
                    Launch App
                </Link>
            </div>
        </header>
    );
}
