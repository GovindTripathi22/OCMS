import Link from "next/link";
import { ArrowRight, Globe, Cpu, Box, Terminal, Braces, ScanLine } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen relative overflow-hidden selection:bg-[var(--ocms-accent)] selection:text-white">

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section className="relative z-10 w-full max-w-6xl mx-auto px-6 pt-32 pb-20">
        <div className="animate-slide-up opacity-0 [animation-delay:100ms] [animation-fill-mode:forwards] mb-6">
          <span className="inline-block px-3 py-1 border-2 border-[var(--ocms-accent)] text-[var(--ocms-accent)] text-[10px] font-mono font-bold uppercase tracking-[0.15em]">
            Content Management • Reimagined
          </span>
        </div>

        <h1 className="animate-slide-up opacity-0 [animation-delay:200ms] [animation-fill-mode:forwards] text-5xl md:text-8xl font-black tracking-tighter text-white leading-[0.9] mb-8">
          From Web<br />
          <span className="text-[var(--ocms-accent)]">to 3D.</span>
        </h1>

        <p className="animate-slide-up opacity-0 [animation-delay:350ms] [animation-fill-mode:forwards] text-lg md:text-xl text-slate-500 max-w-xl font-mono leading-relaxed mb-10">
          Scrape any website. Generate strict schemas with AI. Inject 3D models into a live workspace. Zero friction.
        </p>

        <div className="animate-slide-up opacity-0 [animation-delay:500ms] [animation-fill-mode:forwards] flex flex-col sm:flex-row items-start gap-4">
          <Link
            href="/workspace/new"
            className="boxy-btn bg-white text-black border-white hover:bg-[var(--ocms-accent)] hover:text-white hover:border-[var(--ocms-accent)]"
          >
            Start Building <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="#how-it-works"
            className="boxy-btn text-slate-400 border-slate-700 hover:text-white hover:border-white"
          >
            See How It Works
          </Link>
        </div>
      </section>

      {/* ═══════════════════ THE STORY: HOW IT WORKS ═══════════════════ */}
      <section id="how-it-works" className="relative z-10 w-full max-w-6xl mx-auto px-6 py-20">
        <div className="mb-16 border-b-2 border-[var(--ocms-border)] pb-4">
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-white uppercase">
            The Workflow
          </h2>
          <p className="text-sm font-mono text-slate-600 mt-2">Three steps. Infinite possibilities.</p>
        </div>

        <div className="group/list flex flex-col gap-4">
          {/* ─── STEP 1: SCRAPE ─── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 transition-all duration-500 group-hover/list:blur-[4px] group-hover/list:opacity-30 hover:!blur-none hover:!opacity-100 hover:scale-[1.02] hover:z-10 relative">
            <div className="boxy-panel p-8 md:p-12 flex flex-col justify-center">
              <div className="flex items-center gap-4 mb-6">
                <div className="step-number">01</div>
                <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Scrape</h3>
              </div>
              <p className="text-slate-500 font-mono text-sm leading-relaxed mb-6">
                Point OCMS at any website. Our scraper extracts structured content — text, images, links, metadata — cleanly and precisely.
              </p>
              <div className="flex items-center gap-2 text-[var(--ocms-accent)] text-xs font-mono">
                <Globe className="w-4 h-4" />
                <span>Any URL → Structured Data</span>
              </div>
            </div>
            <div className="boxy-panel p-6 md:p-8 bg-black/40">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--ocms-border)]">
                <ScanLine className="w-4 h-4 text-[var(--ocms-accent)]" />
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Live Scraping</span>
                <span className="ml-auto w-2 h-2 bg-emerald-500 animate-blink" />
              </div>
              <div className="code-block p-4 text-slate-400">
                <div className="text-emerald-400">$ ocms scrape https://example.com</div>
                <div className="mt-2 text-slate-600">→ Fetching DOM...</div>
                <div className="text-slate-600">→ Parsing 247 nodes...</div>
                <div className="text-slate-600">→ Extracting 12 content blocks...</div>
                <div className="mt-2 text-[var(--ocms-accent)]">✓ Scraped successfully (1.2s)</div>
                <div className="text-slate-600 mt-2">
                  {`{ title: "Example Domain",`}<br />
                  {`  headings: ["Example Domain"],`}<br />
                  {`  paragraphs: 3,`}<br />
                  {`  images: 0,`}<br />
                  {`  links: 1 }`}
                </div>
              </div>
            </div>
          </div>

          {/* ─── STEP 2: AI SCHEMA ─── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 transition-all duration-500 group-hover/list:blur-[4px] group-hover/list:opacity-30 hover:!blur-none hover:!opacity-100 hover:scale-[1.02] hover:z-10 relative">
            <div className="boxy-panel p-6 md:p-8 bg-black/40 order-2 md:order-1">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--ocms-border)]">
                <Terminal className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">AI Schema Generator</span>
              </div>
              <div className="code-block p-4 text-slate-400">
                <div className="text-amber-400">{`// AI-generated strict schema`}</div>
                <div className="mt-1">
                  {`{`}<br />
                  {`  "fields": [`}<br />
                  {`    {`}<br />
                  {`      "id": "hero-title",`}<br />
                  {`      "type": "text",`}<br />
                  {`      "value": "Example Domain",`}<br />
                  {`      "selector": "h1",`}<br />
                  <span className="text-[var(--ocms-accent)]">{`      "ai_confidence": 0.99`}</span><br />
                  {`    },`}<br />
                  {`    {`}<br />
                  {`      "id": "hero-img",`}<br />
                  {`      "type": "image",`}<br />
                  <span className="text-emerald-400">{`      "inject_3d": true`}</span><br />
                  {`    }`}<br />
                  {`  ]`}<br />
                  {`}`}
                </div>
              </div>
            </div>
            <div className="boxy-panel p-8 md:p-12 flex flex-col justify-center order-1 md:order-2">
              <div className="flex items-center gap-4 mb-6">
                <div className="step-number">02</div>
                <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">AI Schema</h3>
              </div>
              <p className="text-slate-500 font-mono text-sm leading-relaxed mb-6">
                Our AI analyzes the scraped data and generates a strict, editable JSON schema. Every field is typed, labeled, and ready for your live workspace.
              </p>
              <div className="flex items-center gap-2 text-amber-400 text-xs font-mono">
                <Braces className="w-4 h-4" />
                <span>Raw Data → Strict JSON Schema</span>
              </div>
            </div>
          </div>

          {/* ─── STEP 3: LIVE WORKSPACE ─── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 transition-all duration-500 group-hover/list:blur-[4px] group-hover/list:opacity-30 hover:!blur-none hover:!opacity-100 hover:scale-[1.02] hover:z-10 relative">
            <div className="boxy-panel p-8 md:p-12 flex flex-col justify-center">
              <div className="flex items-center gap-4 mb-6">
                <div className="step-number">03</div>
                <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Live Workspace</h3>
              </div>
              <p className="text-slate-500 font-mono text-sm leading-relaxed mb-6">
                Edit every field in real-time. Drag-and-drop 3D models (.glb/.gltf) to replace 2D images. See changes instantly in the live preview iframe.
              </p>
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono">
                <Box className="w-4 h-4" />
                <span>Edit → Inject 3D → Ship</span>
              </div>
            </div>
            <div className="boxy-panel p-6 md:p-8 bg-black/40">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--ocms-border)]">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Workspace Preview</span>
              </div>
              <div className="grid grid-cols-[1fr_2fr] gap-2 h-48">
                <div className="border border-[var(--ocms-border)] p-3 flex flex-col gap-2">
                  <div className="h-3 w-3/4 bg-slate-800" />
                  <div className="h-3 w-1/2 bg-slate-800" />
                  <div className="h-3 w-full bg-slate-800" />
                  <div className="mt-auto h-6 border border-[var(--ocms-accent)] flex items-center justify-center">
                    <span className="text-[8px] font-mono text-[var(--ocms-accent)]">.glb dropzone</span>
                  </div>
                </div>
                <div className="border border-[var(--ocms-border)] flex items-center justify-center bg-black/30">
                  <div className="text-center">
                    <Box className="w-8 h-8 text-[var(--ocms-accent)] mx-auto mb-2 opacity-60" />
                    <span className="text-[10px] font-mono text-slate-600">Live Preview</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ BOTTOM CTA ═══════════════════ */}
      <section className="relative z-10 w-full max-w-6xl mx-auto px-6 py-20">
        <div className="boxy-panel p-10 md:p-16 text-center">
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-white uppercase mb-4">
            Ready to build?
          </h2>
          <p className="text-sm font-mono text-slate-500 mb-8 max-w-md mx-auto">
            Join the next generation of content management. From scraping to 3D, all in one place.
          </p>
          <Link
            href="/workspace/new"
            className="boxy-btn bg-[var(--ocms-accent)] text-white border-[var(--ocms-accent)] text-base px-8 py-4"
          >
            Launch Workspace <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-10 border-t-2 border-[var(--ocms-border)]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-white uppercase">OCMS</span>
            <span className="text-[10px] font-mono text-slate-600">by SPACHT</span>
          </div>
          <p className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">
            © 2026 SPACHT. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
