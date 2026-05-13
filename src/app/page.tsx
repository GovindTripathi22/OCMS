import Link from "next/link";
import { ArrowRight, Globe, Cpu, Box, Terminal, Braces, ScanLine, Sparkles, Zap, Shield } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen relative overflow-hidden">

      {/* ═══════ Ambient Background ═══════ */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        {/* Deep base */}
        <div className="absolute inset-0 bg-[#080b14]" />
        
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(139,92,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Ambient Orbs */}
        <div className="animate-orb-pulse absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)' }} />
        <div className="animate-orb-pulse absolute top-1/2 -right-60 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.1) 0%, transparent 70%)', animationDelay: '3s' }} />
        <div className="animate-orb-pulse absolute -bottom-40 left-1/3 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)', animationDelay: '6s' }} />
      </div>

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-28 sm:pt-36 pb-16 sm:pb-24 text-center">
        
        <div className="animate-slide-up opacity-0 [animation-fill-mode:forwards] [animation-delay:50ms] mb-6 flex justify-center">
          <span className="feature-tag">
            <Sparkles className="w-3 h-3" />
            AI-Powered Content Management
          </span>
        </div>

        <h1 className="animate-slide-up opacity-0 [animation-fill-mode:forwards] [animation-delay:150ms] text-4xl sm:text-6xl md:text-8xl font-black tracking-tight leading-[1.05] sm:leading-[1] mb-6">
          <span className="text-white">Build Smarter.</span>
          <br />
          <span className="shimmer-text">Edit Faster.</span>
        </h1>

        <p className="animate-slide-up opacity-0 [animation-fill-mode:forwards] [animation-delay:250ms] text-base sm:text-lg md:text-xl text-slate-400 max-w-2xl mx-auto font-light leading-relaxed mb-8 sm:mb-10">
          Scrape any website, generate AI schemas, inject 3D models — all in a live workspace. Zero friction. Maximum power.
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
            { val: "99%", label: "AI Accuracy" },
            { val: "3D", label: "Model Support" },
            { val: "0", label: "Friction" },
          ].map((stat) => (
            <div key={stat.label} className="text-center px-3 sm:px-6 sm:border-r border-white/5 last:border-0">
              <div className="text-2xl font-black text-white mb-1">{stat.val}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Abstract workspace mockup */}
        <div className="animate-slide-up opacity-0 [animation-fill-mode:forwards] [animation-delay:500ms] mt-14 sm:mt-20 relative mx-auto max-w-4xl">
          <div className="glass-card p-1 overflow-hidden relative">
            {/* Top bar */}
            <div className="flex items-center gap-2 px-3 sm:px-4 py-3 border-b border-white/5">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
              <div className="ml-1 sm:ml-4 flex-1 bg-white/5 rounded-lg h-7 flex items-center px-2 sm:px-3 min-w-0">
                <span className="text-[10px] sm:text-xs text-slate-500 font-mono truncate">ocms.ai/workspace/abc123</span>
              </div>
            </div>
            {/* Workspace preview */}
            <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] md:grid-cols-[280px_1fr] min-h-64">
              <div className="border-b sm:border-b-0 sm:border-r border-white/5 p-3 sm:p-4 space-y-3">
                <div className="feature-tag w-fit">Content Fields</div>
                {['Hero Title', 'Subtitle', 'Hero Image', 'CTA Link'].map((f, i) => (
                  <div key={f} className="flex items-center gap-2 bg-white/[0.03] rounded-lg p-2.5 min-w-0">
                    <div className="w-2 h-2 rounded-full" style={{ background: ['#8b5cf6', '#22d3ee', '#fb7185', '#34d399'][i] }} />
                    <span className="text-xs text-slate-300 truncate">{f}</span>
                    <div className="ml-auto w-12 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${[80, 60, 90, 45][i]}%`, background: ['#8b5cf6', '#22d3ee', '#fb7185', '#34d399'][i] }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="relative flex min-h-48 sm:min-h-0 items-center justify-center bg-black/20">
                <div className="text-center">
                  <Box className="w-12 h-12 text-violet-400 mx-auto mb-3 animate-float" />
                  <div className="text-sm text-slate-400">Live Preview</div>
                  <div className="flex items-center gap-1.5 justify-center mt-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-blink" />
                    <span className="text-xs text-emerald-400">Connected</span>
                  </div>
                </div>
                {/* Glow Effect */}
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.05) 0%, transparent 70%)' }} />
              </div>
            </div>
          </div>
          {/* Card glow */}
          <div className="absolute inset-0 -z-10 rounded-2xl blur-3xl"
            style={{ background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.15) 0%, transparent 70%)' }} />
        </div>
      </section>

      {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
      <section id="how-it-works" className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-28">
        <div className="text-center mb-10 sm:mb-20">
          <span className="feature-tag mb-4 inline-flex">The Workflow</span>
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-black text-white tracking-tight mt-4">
            Three steps.
            <span className="gradient-text"> Infinite</span> possibilities.
          </h2>
          <p className="text-slate-500 mt-4 max-w-lg mx-auto">From raw URL to a fully managed 3D workspace in under 5 seconds.</p>
        </div>

        <div className="space-y-6">
          {/* Step 1 */}
          <div className="glass-card p-1 group">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-2xl overflow-hidden">
              <div className="p-5 sm:p-8 lg:p-10 flex flex-col justify-center">
                <div className="flex items-center gap-4 mb-6">
                  <div className="step-number">01</div>
                  <span className="feature-tag" style={{ color: 'var(--ocms-cyan)', borderColor: 'rgba(34,211,238,0.3)', background: 'rgba(34,211,238,0.08)' }}>
                    <Globe className="w-3 h-3" /> Scrape
                  </span>
                </div>
                <h3 className="text-3xl font-black text-white mb-4 tracking-tight">
                  Point. Extract. Done.
                </h3>
                <p className="text-slate-400 leading-relaxed text-sm">
                  Enter any URL and our engine extracts all structured content — text, images, links, and metadata — with surgical precision in under 2 seconds.
                </p>
              </div>
              <div className="bg-black/30 p-5 sm:p-8 flex items-center min-w-0">
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-4">
                    <ScanLine className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Live Scraping</span>
                    <span className="ml-auto w-2 h-2 bg-cyan-400 rounded-full animate-blink" />
                  </div>
                  <div className="code-block">
                    <div className="text-cyan-400">$ ocms scrape https://example.com</div>
                    <div className="mt-2 text-slate-600">→ Fetching DOM...</div>
                    <div className="text-slate-600">→ Parsing 247 nodes...</div>
                    <div className="text-slate-600">→ Extracting content blocks...</div>
                    <div className="mt-2 text-emerald-400">✓ Scraped successfully (1.2s)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="glass-card p-1 group">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-2xl overflow-hidden">
              <div className="bg-black/30 p-5 sm:p-8 flex items-center order-2 md:order-1 min-w-0">
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-4">
                    <Terminal className="w-4 h-4 text-violet-400" />
                    <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">AI Schema</span>
                  </div>
                  <div className="code-block">
                    <div className="text-violet-400">{"// AI-generated strict schema"}</div>
                    <div className="text-slate-400 mt-2">
                      {'{'}<br />
                      {'  "fields": ['}<br />
                      {'    { "id": "hero-title", "type": "text",'}<br />
                      <span className="text-violet-400">{'      "confidence": 0.99 }'}</span><br />
                      {'    { "id": "hero-img", "type": "image",'}<br />
                      <span className="text-cyan-400">{'      "inject_3d": true }'}</span><br />
                      {'  ]'}<br />
                      {'}'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-5 sm:p-8 lg:p-10 flex flex-col justify-center order-1 md:order-2">
                <div className="flex items-center gap-4 mb-6">
                  <div className="step-number">02</div>
                  <span className="feature-tag">
                    <Braces className="w-3 h-3" /> AI Schema
                  </span>
                </div>
                <h3 className="text-3xl font-black text-white mb-4 tracking-tight">
                  AI Understands. Schema Generated.
                </h3>
                <p className="text-slate-400 leading-relaxed text-sm">
                  Gemini AI analyzes scraped data and generates a strict, editable JSON schema. Every field is typed, labeled, and confidence-scored.
                </p>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="glass-card p-1 group">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-2xl overflow-hidden">
              <div className="p-5 sm:p-8 lg:p-10 flex flex-col justify-center">
                <div className="flex items-center gap-4 mb-6">
                  <div className="step-number">03</div>
                  <span className="feature-tag" style={{ color: 'var(--ocms-green)', borderColor: 'rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.08)' }}>
                    <Box className="w-3 h-3" /> Live Edit
                  </span>
                </div>
                <h3 className="text-3xl font-black text-white mb-4 tracking-tight">
                  Edit Live. Push to GitHub.
                </h3>
                <p className="text-slate-400 leading-relaxed text-sm">
                  Edit every field in real-time. Drop 3D models to replace 2D images. See changes instantly in the live preview. Push to GitHub with one click.
                </p>
              </div>
              <div className="bg-black/30 p-5 sm:p-8 flex items-center min-w-0">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3 w-full min-h-48">
                  <div className="border border-white/5 rounded-xl p-3 flex flex-col gap-2 bg-black/20">
                    {['Hero', 'Sub', 'Img', 'CTA'].map((l, i) => (
                      <div key={l} className="h-6 rounded-md bg-white/[0.04] flex items-center px-2">
                        <span className="text-[9px] text-slate-500">{l}</span>
                        <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: ['#8b5cf6','#22d3ee','#fb7185','#34d399'][i] }} />
                      </div>
                    ))}
                  </div>
                  <div className="border border-white/5 rounded-xl flex items-center justify-center bg-black/20 relative overflow-hidden">
                    <Box className="w-10 h-10 text-violet-400/60 animate-float" />
                    <div className="absolute bottom-2 right-2">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-blink" />
                        <span className="text-[9px] text-emerald-400">Live</span>
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
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
            Packed with <span className="gradient-text">power</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: <Globe className="w-5 h-5" />, title: "Universal Scraper", desc: "Extract content from any site. Text, images, links — all structured and ready.", color: '#22d3ee' },
            { icon: <Cpu className="w-5 h-5" />, title: "Gemini AI Schema", desc: "AI generates typed schemas with 99% accuracy. Every field confidence-scored.", color: '#8b5cf6' },
            { icon: <Box className="w-5 h-5" />, title: "3D Model Injector", desc: "Drop .glb or .gltf files to replace 2D images with interactive 3D models.", color: '#fb7185' },
            { icon: <Zap className="w-5 h-5" />, title: "Voice Commands", desc: "Speak your edit. AI understands and applies changes in real time.", color: '#34d399' },
            { icon: <Shield className="w-5 h-5" />, title: "Ghost Co-Pilot", desc: "Watch a ghost cursor show exactly what the AI is editing — live.", color: '#f59e0b' },
            { icon: <Terminal className="w-5 h-5" />, title: "GitHub Sync", desc: "Push changes directly to any GitHub repo with one click via Gemini.", color: '#22d3ee' },
          ].map((feat) => (
            <div key={feat.title} className="glass-card p-6 group">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all duration-300"
                style={{ background: `${feat.color}15`, color: feat.color }}>
                {feat.icon}
              </div>
              <h3 className="text-base font-bold text-white mb-2">{feat.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════ CTA ═══════════════════ */}
      <section className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <div className="relative glass-card p-6 sm:p-14 md:p-20 text-center overflow-hidden">
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.1) 0%, transparent 70%)' }} />
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-black text-white tracking-tight mb-4 relative">
            Ready to build?
          </h2>
          <p className="text-slate-400 mb-8 max-w-lg mx-auto relative text-base sm:text-lg">
            Join the next generation of content management.
          </p>
          <Link href="/workspace/new" className="glow-btn text-sm sm:text-base px-6 sm:px-10 py-3.5 sm:py-4 relative inline-flex">
            Launch Workspace <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-10 border-t border-white/[0.06]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-black text-white">OCMS</span>
            <span className="text-xs text-slate-600 font-mono">by SPACHT</span>
          </div>
          <p className="text-xs font-mono text-slate-600 uppercase tracking-wider">
            (c) 2026 SPACHT. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
