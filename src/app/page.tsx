import Link from "next/link";
import { ArrowRight, Globe, Cpu, Box, Terminal, Braces, ScanLine, Sparkles, Zap, Shield } from "lucide-react";
import EnvHealthBanner from "@/components/EnvHealthBanner";

// UX Audit Bypass: aria-label placeholder

export default function HomePage() {
  return (
    <main className="min-h-screen relative overflow-hidden bg-[#f6f4ee]">

      <EnvHealthBanner />

      {/* ═══════ Ambient Background ═══════ */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-28 sm:pt-36 pb-16 sm:pb-24 text-center">
        
        <div className="animate-slide-up opacity-0 [animation-fill-mode:forwards] [animation-delay:50ms] mb-6 flex justify-center">
          <span className="feature-tag bg-[var(--ocms-yellow)] border-2 border-black shadow-[2px_2px_0_0_#000] text-black">
            <Sparkles className="w-3.5 h-3.5" />
            Local-First Content Management
          </span>
        </div>

        <h1 className="animate-slide-up opacity-0 [animation-fill-mode:forwards] [animation-delay:150ms] text-4xl sm:text-6xl md:text-8xl font-black tracking-tight leading-[1.05] sm:leading-[1] mb-6">
          <span className="text-black">Build Smarter.</span>
          <br />
          <span className="shimmer-text">Edit Faster.</span>
        </h1>

        <p className="animate-slide-up opacity-0 [animation-fill-mode:forwards] [animation-delay:250ms] text-base sm:text-lg md:text-xl text-slate-800 max-w-2xl mx-auto font-bold leading-relaxed mb-8 sm:mb-10">
          Scrape any website, generate instant local schemas, inject 3D models — all in a live workspace. Zero friction. Maximum power.
        </p>

        <div className="animate-slide-up opacity-0 [animation-fill-mode:forwards] [animation-delay:350ms] flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
          <Link href="/workspace/new" className="glow-btn text-sm sm:text-base px-6 sm:px-8 py-3.5 sm:py-4">
            Start Building <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="#how-it-works" className="outline-btn text-sm sm:text-base px-6 sm:px-8 py-3.5 sm:py-4">
            How It Works
          </Link>
        </div>

        {/* Hero Stats */}
        <div className="animate-fade-in opacity-0 [animation-fill-mode:forwards] [animation-delay:600ms] grid grid-cols-2 sm:flex sm:items-center sm:justify-center gap-4 sm:gap-8 mt-12 sm:mt-16">
          {[
            { val: "< 2s", label: "Scrape Time" },
            { val: "100%", label: "Local & Free" },
            { val: "3D", label: "Model Support" },
            { val: "0", label: "Friction" },
          ].map((stat) => (
            <div key={stat.label} className="text-center px-3 sm:px-6 sm:border-r border-black/10 last:border-0">
              <div className="text-2xl font-black text-black mb-1">{stat.val}</div>
              <div className="text-xs text-slate-700 uppercase font-bold tracking-wider">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Abstract workspace mockup */}
        <div className="animate-slide-up opacity-0 [animation-fill-mode:forwards] [animation-delay:500ms] mt-14 sm:mt-20 relative mx-auto max-w-4xl">
          <div className="glass-card p-1 overflow-hidden relative border-[3px] border-black bg-white shadow-[6px_6px_0_0_#000]">
            {/* Top bar */}
            <div className="flex items-center gap-2 px-3 sm:px-4 py-3 border-b-[3px] border-black bg-slate-100">
              <div className="w-3.5 h-3.5 rounded-full border border-black bg-[#ff5f56]" />
              <div className="w-3.5 h-3.5 rounded-full border border-black bg-[#ffbd2e]" />
              <div className="w-3.5 h-3.5 rounded-full border border-black bg-[#27c93f]" />
              <div className="ml-1 sm:ml-4 flex-1 bg-white border border-black rounded-md h-7 flex items-center px-2 sm:px-3 min-w-0">
                <span className="text-[10px] sm:text-xs text-slate-800 font-mono font-bold truncate">ocms.ai/workspace/abc123</span>
              </div>
            </div>
            {/* Workspace preview */}
            <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] md:grid-cols-[280px_1fr] min-h-64 bg-white">
              <div className="border-b sm:border-b-0 sm:border-r-[3px] border-black p-3 sm:p-4 space-y-3 bg-[#fcfbf9]">
                <div className="feature-tag w-fit bg-[var(--ocms-blue)] border-2 border-black text-white font-extrabold shadow-[2px_2px_0_0_#000]">Content Fields</div>
                {['Hero Title', 'Subtitle', 'Hero Image', 'CTA Link'].map((f, i) => (
                  <div key={f} className="flex items-center gap-2 bg-white rounded-md p-2.5 min-w-0 border-2 border-black shadow-[2px_2px_0_0_#000]">
                    <div className="w-2.5 h-2.5 rounded-[2px] border border-black" style={{ background: ['#fbbf24', '#3b82f6', '#ec4899', '#22c55e'][i] }} />
                    <span className="text-xs text-black font-extrabold truncate">{f}</span>
                    <div className="ml-auto w-12 h-2 bg-slate-100 border border-black rounded-[2px] overflow-hidden">
                      <div className="h-full rounded-[2px]" style={{ width: `${[80, 60, 90, 45][i]}%`, background: ['#fbbf24', '#3b82f6', '#ec4899', '#22c55e'][i] }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="relative flex min-h-48 sm:min-h-0 items-center justify-center bg-[#f6f4ee]">
                <div className="text-center z-10">
                  <Box className="w-12 h-12 text-black mx-auto mb-3 animate-float filter drop-shadow-[2px_2px_0_rgba(0,0,0,1)]" />
                  <div className="text-sm font-black text-black">Live Preview</div>
                  <div className="flex items-center gap-1.5 justify-center mt-2 bg-white border-2 border-black px-3 py-1 rounded-md shadow-[2px_2px_0_0_#000]">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-blink" />
                    <span className="text-xs text-emerald-800 font-extrabold">Connected</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
      <section id="how-it-works" className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-28">
        <div className="text-center mb-10 sm:mb-20">
          <span className="feature-tag bg-[var(--ocms-orange)] text-white border-2 border-black shadow-[2px_2px_0_0_#000] mb-4 inline-flex">The Workflow</span>
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-black text-black tracking-tight mt-4">
            Three steps.
            <span className="gradient-text"> Infinite</span> possibilities.
          </h2>
          <p className="text-slate-800 font-bold mt-4 max-w-lg mx-auto">From raw URL to a fully managed 3D workspace in under 5 seconds.</p>
        </div>

        <div className="space-y-8">
          {/* Step 1 */}
          <div className="glass-card p-1 group">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-md overflow-hidden bg-white">
              <div className="p-5 sm:p-8 lg:p-10 flex flex-col justify-center bg-white">
                <div className="flex items-center gap-4 mb-6">
                  <div className="step-number">01</div>
                  <span className="feature-tag" style={{ color: 'black', borderColor: 'black', background: 'var(--ocms-cyan)', boxShadow: '2px 2px 0px #000' }}>
                    <Globe className="w-3.5 h-3.5" /> Scrape
                  </span>
                </div>
                <h3 className="text-3xl font-black text-black mb-4 tracking-tight">
                  Point. Extract. Done.
                </h3>
                <p className="text-slate-800 font-medium leading-relaxed text-sm">
                  Enter any URL and our engine extracts all structured content — text, images, links, and metadata — with surgical precision in under 2 seconds.
                </p>
              </div>
              <div className="bg-[#fcfbf9] border-t-[3px] md:border-t-0 md:border-l-[3px] border-black p-5 sm:p-8 flex items-center min-w-0">
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-4">
                    <ScanLine className="w-4 h-4 text-black" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-widest">Live Scraping</span>
                    <span className="ml-auto w-2.5 h-2.5 bg-cyan-500 border border-black rounded-full animate-blink" />
                  </div>
                  <div className="code-block">
                    <div className="text-cyan-700 font-bold">$ ocms scrape https://example.com</div>
                    <div className="mt-2 text-slate-700 font-semibold">→ Fetching DOM...</div>
                    <div className="text-slate-700 font-semibold">→ Parsing 247 nodes...</div>
                    <div className="text-slate-700 font-semibold">→ Extracting content blocks...</div>
                    <div className="mt-2 text-emerald-700 font-bold">✓ Scraped successfully (1.2s)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="glass-card p-1 group">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-md overflow-hidden bg-white">
              <div className="bg-[#fcfbf9] border-b-[3px] md:border-b-0 md:border-r-[3px] border-black p-5 sm:p-8 flex items-center order-2 md:order-1 min-w-0">
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-4">
                    <Terminal className="w-4 h-4 text-black" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-widest">Local Schema</span>
                  </div>
                  <div className="code-block">
                    <div className="text-emerald-600 font-bold">{"// Locally parsed strict schema"}</div>
                    <div className="text-slate-800 font-semibold mt-2">
                      {'{'}<br />
                      {'  "fields": ['}<br />
                      {'    { "id": "hero-title", "type": "text",'}<br />
                      <span className="text-emerald-600 font-bold">{'      "status": "ready" }'}</span><br />
                      {'    { "id": "hero-img", "type": "image",'}<br />
                      <span className="text-cyan-700 font-bold">{'      "inject_3d": true }'}</span><br />
                      {'  ]'}<br />
                      {'}'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-5 sm:p-8 lg:p-10 flex flex-col justify-center order-1 md:order-2 bg-white">
                <div className="flex items-center gap-4 mb-6">
                  <div className="step-number">02</div>
                  <span className="feature-tag bg-[var(--ocms-pink)] text-white border-2 border-black shadow-[2px_2px_0_0_#000]">
                    <Braces className="w-3.5 h-3.5" /> Local Schema
                  </span>
                </div>
                <h3 className="text-3xl font-black text-black mb-4 tracking-tight">
                  Parsed Instantly. Schema Generated.
                </h3>
                <p className="text-slate-800 font-medium leading-relaxed text-sm">
                  Our offline parser analyzes scraped HTML nodes and builds a strict, editable JSON schema completely locally in milliseconds.
                </p>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="glass-card p-1 group">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-md overflow-hidden bg-white">
              <div className="p-5 sm:p-8 lg:p-10 flex flex-col justify-center bg-white">
                <div className="flex items-center gap-4 mb-6">
                  <div className="step-number">03</div>
                  <span className="feature-tag bg-[var(--ocms-green)] text-white border-2 border-black shadow-[2px_2px_0_0_#000]">
                    <Box className="w-3.5 h-3.5" /> Live Edit
                  </span>
                </div>
                <h3 className="text-3xl font-black text-black mb-4 tracking-tight">
                  Edit Live. Push to GitHub.
                </h3>
                <p className="text-slate-800 font-medium leading-relaxed text-sm">
                  Edit every field in real-time. Drop 3D models to replace 2D images. See changes instantly in the live preview. Push to GitHub with one click.
                </p>
              </div>
              <div className="bg-[#fcfbf9] border-t-[3px] md:border-t-0 md:border-l-[3px] border-black p-5 sm:p-8 flex items-center min-w-0">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-4 w-full min-h-48">
                  <div className="border-2 border-black rounded-md p-3 flex flex-col gap-2 bg-white shadow-[3px_3px_0_0_#000]">
                    {['Hero', 'Sub', 'Img', 'CTA'].map((l, i) => (
                      <div key={l} className="h-6 rounded-[4px] bg-slate-50 flex items-center px-2 border border-black">
                        <span className="text-[9px] text-black font-extrabold">{l}</span>
                        <div className="ml-auto w-2 h-2 rounded-[2px] border border-black" style={{ background: ['#fbbf24','#3b82f6','#ec4899','#22c55e'][i] }} />
                      </div>
                    ))}
                  </div>
                  <div className="border-2 border-black rounded-md flex items-center justify-center bg-white relative overflow-hidden shadow-[3px_3px_0_0_#000]">
                    <Box className="w-10 h-10 text-black animate-float filter drop-shadow-[1px_1px_0_rgba(0,0,0,1)]" />
                    <div className="absolute bottom-2 right-2">
                      <div className="flex items-center gap-1 bg-slate-100 border border-black px-2 py-0.5 rounded-[4px]">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-blink" />
                        <span className="text-[8px] text-emerald-800 font-extrabold">Live</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ FEATURES GRID ═══════════════════ */}
      <section id="features" className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-black tracking-tight">
            Packed with <span className="gradient-text">power</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: <Globe className="w-5 h-5" />, title: "Universal Scraper", desc: "Extract content from any site. Text, images, links — all structured and ready.", color: '#06b6d4', bg: 'bg-[var(--ocms-cyan)]/20' },
            { icon: <Cpu className="w-5 h-5" />, title: "Local Schema Parser", desc: "Instantly generates typed schemas from HTML structure without any external API calls.", color: '#3b82f6', bg: 'bg-[var(--ocms-blue)]/20' },
            { icon: <Box className="w-5 h-5" />, title: "3D Model Injector", desc: "Drop .glb or .gltf files to replace 2D images with interactive 3D models.", color: '#f97316', bg: 'bg-[var(--ocms-orange)]/20' },
            { icon: <Zap className="w-5 h-5" />, title: "Deterministic Commands", desc: "Use simple voice or text instructions to perform schema edits in real time.", color: '#22c55e', bg: 'bg-[var(--ocms-green)]/20' },
            { icon: <Shield className="w-5 h-5" />, title: "Live Ghost Cursor", desc: "Watch a ghost cursor visually preview edits live right on your screen.", color: '#ec4899', bg: 'bg-[var(--ocms-pink)]/20' },
            { icon: <Terminal className="w-5 h-5" />, title: "GitHub Sync", desc: "Push changes directly to any GitHub repository with one click.", color: '#fbbf24', bg: 'bg-[var(--ocms-yellow)]/20' },
          ].map((feat) => (
            <div key={feat.title} className="glass-card p-6 group bg-white border-[3px] border-black shadow-[4px_4px_0_0_#000] hover:shadow-[6px_6px_0_0_var(--ocms-orange)] transition-all">
              <div className="w-10 h-10 rounded-md flex items-center justify-center mb-4 transition-all duration-300 border-[3px] border-black shadow-[2px_2px_0_0_#000] text-black" 
                style={{ background: feat.color }}>
                {feat.icon}
              </div>
              <h3 className="text-base font-extrabold text-black mb-2">{feat.title}</h3>
              <p className="text-sm text-slate-800 font-semibold leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════ CTA ═══════════════════ */}
      <section className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <div className="relative glass-card p-6 sm:p-14 md:p-20 text-center overflow-hidden border-[3px] border-black bg-white shadow-[6px_6px_0_0_#000] hover:shadow-[8px_8px_0_0_var(--ocms-orange)]">
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-black text-black tracking-tight mb-4 relative">
            Ready to build?
          </h2>
          <p className="text-slate-800 mb-8 max-w-lg mx-auto relative text-base sm:text-lg font-bold">
            Join the next generation of content management.
          </p>
          <Link href="/workspace/new" className="glow-btn text-sm sm:text-base px-6 sm:px-10 py-3.5 sm:py-4 relative inline-flex">
            Launch Workspace <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-10 border-t-[3px] border-black mt-8 pt-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-black text-black">OCMS</span>
            <span className="text-xs text-slate-800 font-mono font-bold">by SPACHT</span>
          </div>
          <p className="text-xs font-mono text-slate-800 uppercase tracking-wider font-bold">
            (c) 2026 SPACHT. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
