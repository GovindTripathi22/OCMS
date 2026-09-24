# OCMS — Open Content Management System

**OCMS** is a local-first, privacy-respecting, 100% deterministic headless CMS built for modern web applications. Point it at any website URL, and it scrapes the page, generates an editable schema, and lets you visually edit text, images, links, and 3D models — then push changes directly to GitHub (or sync to your local repository) with one click.

Zero AI dependencies. Zero third-party LLM calls. No vendor lock-in. Your data stays completely under your control.

---

## ✨ Core Capabilities

| Feature | Description |
|---------|-------------|
| **Universal Web Scraper** | Point to any URL → OCMS safely fetches HTML (SSRF-protected) and extracts editable content nodes |
| **Local Schema Generator** | Generates typed schema fields (text, image, link, 3D model) directly from DOM hierarchy |
| **Live Visual Editor** | Side-by-side iframe preview with Ghost Cursor, click-to-edit, inline toolbar, and live DOM updates |
| **Atomic GitHub & Local Sync** | Creates pull requests on GitHub or applies atomic local file updates with syntax validation and rollback |
| **3D Model Injector** | Drag-and-drop `.glb` / `.gltf` models to replace 2D images, with mesh decimation & PBR material tuning |
| **Deterministic Color Engine** | Scrapes real CSS variables and styles from target websites, or matches against 12+ curated design palettes |
| **Deterministic A/B Copy Engine** | Rule-based semantic variation generator for headlines, CTAs, and body copy without external AI |
| **Token Encryption at Rest** | GitHub OAuth access and refresh tokens encrypted with AES-256-GCM authenticated encryption |
| **Fail-Closed Security** | SSRF prevention with pinned DNS lookups, strict iframe sandbox, CSP headers, and timing-safe webhook HMAC |

---

## 🏗️ Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Next.js App (App Router)                        │
│                                                                        │
│  ┌──────────────┐    ┌──────────────────────────────────────────────┐  │
│  │  Landing     │    │  Workspace (/workspace/[projectId])          │  │
│  │  Page (/)    │    │  ┌────────────────────┐ ┌──────────────────┐ │  │
│  └──────────────┘    │  │  ContentEditor     │ │  LivePreview     │ │  │
│                      │  │  (Schema & Fields) │ │  (Iframe Bridge) │ │  │
│  ┌──────────────┐    │  └────────────────────┘ └──────────────────┘ │  │
│  │  Auth.js     │    └──────────────────────────────────────────────┘  │
│  │  (NextAuth   │                                                      │
│  │   v5)        │    Modular Proxy Engine (src/lib/proxy/):            │
│  └──────────────┘    • URL resolver & rewriter                         │
│                      • Script sanitizer & event handler stripper       │
│                      • Bounded stream reader (DoS protection)          │
│                      • Client postMessage bridge & history guard       │
└──────────────────────────────────────┬─────────────────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
   Prisma ORM                     Octokit Client              Atomic Patchers
 (SQLite / Postgres)          (GitHub OAuth & Repos)        (Babel AST / Cheerio)
        │
   AES-256-GCM
 Token Encryption
```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env.local` and configure your settings:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Yes | Database connection string. SQLite: `file:./dev.db` (PostgreSQL in production) |
| `AUTH_SECRET` | ✅ Yes | Session encryption key. Generate with `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | Optional | Dedicated 32-byte key for AES-256-GCM token encryption (falls back to `AUTH_SECRET`) |
| `NEXTAUTH_URL` | ✅ Prod | Canonical URL of your deployment (e.g. `https://your-domain.com`) |
| `GITHUB_CLIENT_ID` | ✅ Yes | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | ✅ Yes | GitHub OAuth App Client Secret |
| `GITHUB_WEBHOOK_SECRET` | Optional | Secret for verifying GitHub repository webhooks (HMAC SHA-256) |
| `STORAGE_MODE` | Optional | `local` (filesystem storage) or `cloud` (S3/R2 storage). Defaults to `local` in dev |
| `LOCAL_WORKSPACE_PATH` | Optional | Absolute root directory of local codebase for direct disk sync in dev mode |
| `ALLOW_GUEST_ACCESS` | Dev Only | Set `true` to allow guest access without OAuth in development mode |
| `ALLOW_LOCAL_SSRF` | Dev Only | Set `true` to allow testing proxy/scraper against localhost IPs in development |

> **Security Invariant:** `ALLOW_GUEST_ACCESS=true` and `ALLOW_LOCAL_SSRF=true` are hard-blocked whenever `NODE_ENV=production`.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ (Node 18+ supported)
- npm 9+
- GitHub Account (for OAuth and repository syncing)

### 1. Installation
```bash
git clone https://github.com/GovindTripathi22/OCMS.git
cd ocms
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env.local
# Fill in your AUTH_SECRET, GITHUB_CLIENT_ID, and GITHUB_CLIENT_SECRET
```

### 3. Initialize Database
```bash
npx prisma generate
npx prisma db push
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Verification & Testing Suite

OCMS maintains a strict test battery covering security, patcher smoke tests, and end-to-end flows:

```bash
# 1. Run all unit and integration test suites (Jest)
npm test

# 2. Run AST and HTML patcher safety tests
npm run test:patchers

# 3. Run TypeScript strict type verification
npm run type-check

# 4. Run ESLint checks
npm run lint

# 5. Run end-to-end browser integration tests (Playwright)
npm run test:e2e

# 6. Run production build
npm run build
```

---

## 🔒 Security Model

1. **SSRF Defense with Pinned DNS Lookup**: All outbound scraping and proxy requests resolve DNS records upfront, enforce IPv4/IPv6 private/loopback/cloud metadata IP blocklists, and pin the validated IP to the socket connection via Node 20+ `{ all: true }` lookup handlers.
2. **AES-256-GCM Token Encryption**: OAuth access and refresh tokens stored in the database are encrypted at rest with random 12-byte initialization vectors and 16-byte authentication tags. Legacy tokens are read seamlessly without data loss.
3. **Iframe Isolation & Script Filtering**: The live preview iframe operates with strict sandbox policies (`allow-scripts allow-forms`). In static mode, executable scripts and inline event handlers (`onload`, `onclick`, `<svg/onload>`) are stripped while structured JSON-LD schemas remain intact.
4. **Timing-Safe Webhook Verification & Idempotency**: Webhook requests from GitHub are verified using `crypto.timingSafeEqual` with HMAC SHA-256 and deduplicated using delivery ID caches to prevent replay attacks.
5. **Atomic Disk Synchronization**: Local publishing creates snapshot backups and writes to temporary files before atomically replacing target source files, immediately rolling back upon any syntax error.

---

## 👥 Authors & License

Built with precision and passion by **Team SPACHT**.  
© 2026 SPACHT. Open source software.
