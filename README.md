# OCMS — Open Content Management System

**OCMS** is a local-first, privacy-respecting headless CMS built for developers. Point it at any website URL, and it scrapes the page, generates an editable schema, and lets you visually edit text, images, links, and 3D models — then push changes directly to GitHub with one click.

No cloud. No subscriptions. No vendor lock-in. Your data stays in your database.

---

## ✨ What OCMS Does

| Feature | Description |
|---------|-------------|
| **URL Scraper** | Enter any URL → OCMS fetches the HTML and extracts all editable content fields automatically |
| **Local Schema** | Generates a typed JSON schema (text, image, link, 3D model) from the page structure — no AI required |
| **Live Preview** | Side-by-side iframe preview with a "Ghost Cursor" that shows edits in real time |
| **GitHub Sync** | Push content changes directly to any GitHub repository using your OAuth token |
| **3D Model Injector** | Drop `.glb` / `.gltf` files to replace 2D images with interactive 3D models |
| **A/B Variant Engine** | Generate alternative copy variants for different audiences |
| **Color Palette Tool** | Generate and apply harmonious color palettes to your site's CSS variables |
| **Voice Commands** | Dictate field edits using Web Speech API |
| **Build Validation** | TypeScript build check before every GitHub push |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Next.js App (App Router)           │
│                                                     │
│  ┌──────────────┐    ┌──────────────────────────┐  │
│  │  Landing Page │    │  Workspace (/workspace/  │  │
│  │  (/)          │    │  [projectId])            │  │
│  └──────────────┘    │  ┌────────────────────┐  │  │
│                      │  │  ContentEditor     │  │  │
│  ┌──────────────┐    │  │  (field editing)   │  │  │
│  │  Auth.js     │    │  ├────────────────────┤  │  │
│  │  (GitHub     │    │  │  LivePreview       │  │  │
│  │   OAuth)     │    │  │  (iframe + ghost)  │  │  │
│  └──────────────┘    │  └────────────────────┘  │  │
│                      └──────────────────────────┘  │
│  API Routes:                                        │
│  • /api/projects          — Create / list projects  │
│  • /api/projects/[id]/    — Scan, schema, GSD       │
│  • /api/publish-changes   — GitHub push + AST patch │
│  • /api/auth/*            — NextAuth handlers       │
│  • /api/check-env         — Env health check        │
└─────────────────────────────────────────────────────┘
        │                         │
   Prisma ORM                 Octokit
   (SQLite / Postgres)        (GitHub API)
```

### Key Libraries
- **Next.js 14** (App Router, Server Components)
- **Auth.js / NextAuth v5** (GitHub OAuth, Prisma adapter)
- **Prisma ORM** (SQLite default, PostgreSQL for production)
- **@octokit/rest** (GitHub API)
- **Babel AST parser** (deterministic code patching without AI)
- **Cheerio** (server-side HTML scraping)

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env.local` and fill in the values.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Yes | Database connection string. SQLite: `file:./dev.db` |
| `AUTH_SECRET` | ✅ Yes | Session encryption key. Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ Production | Your deployment URL. e.g. `https://your-app.vercel.app` |
| `GITHUB_CLIENT_ID` | ✅ Yes | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | ✅ Yes | GitHub OAuth App Client Secret |
| `LOCAL_WORKSPACE_PATH` | Optional | Absolute path to local project for dev-mode file sync |
| `ALLOW_GUEST_ACCESS` | Dev only | Set `true` to allow no-auth guest login in development |
| `ALLOW_LOCAL_SSRF` | Dev only | Set `true` to allow scraping `localhost` URLs in dev |
| `REPLICATE_API_TOKEN` | Optional | Required for Replicate-powered texture generation |

> **Security note:** Never set `ALLOW_GUEST_ACCESS=true` or `ALLOW_LOCAL_SSRF=true` in production. These are hard-blocked when `NODE_ENV=production`.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- A GitHub account (for the OAuth flow)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local with your values
```

### 3. Set Up Database

```bash
npx prisma generate
npx prisma db push
```

### 4. (Dev) Set Up Guest Mode (optional)

If you don't have GitHub OAuth credentials yet:

```env
# .env.local
ALLOW_GUEST_ACCESS=true
ALLOW_LOCAL_SSRF=true
LOCAL_WORKSPACE_PATH=/absolute/path/to/your/project
```

Then start the app, visit `/api/auth/mock` (POST) via the UI, and you'll get a dev session with local filesystem sync.

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 🔐 GitHub Integration

OCMS uses GitHub OAuth to:
1. Authenticate users
2. Store a GitHub access token (with `repo` scope)
3. Fetch, patch, and push source files on your behalf

### Setting Up a GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Set the callback URL to: `http://localhost:3000/api/auth/callback/github` (or your production URL)
4. Copy the **Client ID** and **Client Secret** into `.env.local`

---

## 🌐 Demo Mode vs Production Mode

| | Demo / Dev Mode | Production Mode |
|---|---|---|
| **Auth** | Guest fallback available (`ALLOW_GUEST_ACCESS=true`) | Real GitHub OAuth required |
| **File sync** | Local filesystem (`LOCAL_WORKSPACE_PATH`) | GitHub API push only |
| **Scraping** | Localhost URLs allowed (`ALLOW_LOCAL_SSRF=true`) | External URLs only |
| **Mock token** | `mock_token` activates local sync | Blocked (403) |
| **Env banner** | Warns about missing/placeholder vars | Same |

---

## 🚢 Deploying to Production (Vercel)

```bash
# 1. Build to verify no errors
npm run build

# 2. Deploy
vercel deploy --prod
```

### Required Environment Variables (Vercel)

Set these in your Vercel project settings:

```
DATABASE_URL         = postgresql://...   # Use Vercel Postgres or Neon
AUTH_SECRET          = <generated>
NEXTAUTH_URL         = https://your-app.vercel.app
GITHUB_CLIENT_ID     = <your OAuth app>
GITHUB_CLIENT_SECRET = <your OAuth app>
```

> **Note:** SQLite is not suitable for multi-user production. Use PostgreSQL (e.g., [Vercel Postgres](https://vercel.com/storage/postgres) or [Neon](https://neon.tech)). Update `prisma/schema.prisma` to `provider = "postgresql"` and run `npx prisma db push`.

---

## 📦 Building and Running

```bash
# Development
npm run dev

# Build check (required before deploying)
npm run build

# Production server
npm start

# Lint
npm run lint

# Run patcher smoke tests
npm run test:patchers
```

---

## 👥 Authors

Built with precision and passion by **Team SPACHT**.

---

## 📄 License

© 2026 SPACHT. All rights reserved.
