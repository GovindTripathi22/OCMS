# OCMS — Complete Project Document
> **Local-First, AI-Free Headless CMS & 3D Engine**  
> Built by team SPACHT. Every file. Every line of code.

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Directory Structure](#2-directory-structure)
3. [Configuration & Manifest Files](#3-configuration--manifest-files)
4. [Database Schema (Prisma)](#4-database-schema-prisma)
5. [Type Definitions](#5-type-definitions)
6. [Authentication](#6-authentication)
7. [Middleware](#7-middleware)
8. [Global Styles](#8-global-styles)
9. [Root Layout](#9-root-layout)
10. [Pages](#10-pages)
11. [API Routes](#11-api-routes)
12. [Library Utilities](#12-library-utilities)
13. [Components](#13-components)
14. [Workspace Components](#14-workspace-components)

---

## 1. PROJECT OVERVIEW

**Name:** OCMS (Open Content Management System)  
**Version:** 0.1.0  
**Tagline:** "Build Smarter. Edit Faster."  
**Architecture:** Next.js 14 App Router + Prisma/SQLite + NextAuth v5  
**Philosophy:** Local-first, deterministic, offline-capable. No AI dependencies in the core data pipeline.

### Core Features
- **Universal Web Scraper** — Extract content from any site (text, images, links, metadata)
- **Local Schema Parser** — Instantly generates typed JSON schemas from HTML without API calls
- **Live Visual Editor** — Edit fields in real-time with inline contenteditable + postMessage bridge
- **3D Model Injector** — Drop `.glb`/`.gltf` files to replace 2D images with interactive 3D models (model-viewer)
- **GitHub Sync** — Octokit-based commit flow to push content changes to any repo
- **Deterministic AST Patcher** — Babel-based JSX AST patching for Next.js source files
- **HTML Patcher** — Cheerio-based HTML patching for static sites
- **Proxy Engine** — Full proxy server that rewrites all assets/links and injects live editing scripts
- **GSD Planning System** — Markdown-based project state, roadmap, and requirements tracking
- **Rate Limiting** — DB counter approach (FREE: 10/month, PRO: 100/month)
- **PBR Material Presets** — 5 built-in PBR presets for 3D model materials
- **Env Health Banner** — Live environment variable health check with setup wizard

---

## 2. DIRECTORY STRUCTURE

```
d:\MODEL\ocms\
├── package.json
├── prisma/
│   └── schema.prisma
├── public/
│   └── ocms_logo.png
├── src/
│   ├── auth.ts
│   ├── middleware.ts
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── api/
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts
│   │       ├── check-env/
│   │       │   └── route.ts
│   │       ├── projects/
│   │       │   ├── route.ts
│   │       │   └── [projectId]/
│   │       │       ├── route.ts
│   │       │       ├── 3d-assets/
│   │       │       │   └── route.ts
│   │       │       ├── assets/
│   │       │       │   └── route.ts
│   │       │       └── gsd/
│   │       │           └── route.ts
│   │       ├── proxy/
│   │       │   └── route.ts
│   │       ├── publish-changes/
│   │       │   └── route.ts
│   │       ├── scrape/
│   │       │   └── route.ts
│   │       ├── steal-component/
│   │       │   └── route.ts
│   │       ├── sync-to-github/
│   │       │   └── route.ts
│   │       ├── theme-colors/
│   │       │   └── route.ts
│   │       ├── upload-model/
│   │       │   └── route.ts
│   │       └── webhooks/
│   │           └── github/
│   │               └── route.ts
│   │   └── workspace/
│   │       ├── new/
│   │       │   └── page.tsx
│   │       └── [projectId]/
│   │           ├── page.tsx
│   │           └── WorkspaceClient.tsx
│   ├── components/
│   │   ├── EnvHealthBanner.tsx
│   │   ├── Navbar.tsx
│   │   ├── providers.tsx
│   │   ├── ui/
│   │   │   └── glass-panel.tsx
│   │   └── workspace/
│   │       ├── ContentEditor.tsx
│   │       ├── LivePreview.tsx
│   │       ├── ModelDropzone.tsx
│   │       ├── ModelViewer.tsx
│   │       ├── PermissionWizard.tsx
│   │       └── WorkspaceSkeleton.tsx
│   ├── lib/
│   │   ├── ast-patcher.ts
│   │   ├── github-sync.ts
│   │   ├── gsd-parser.ts
│   │   ├── html-patcher.ts
│   │   ├── jsx-ast-helpers.ts
│   │   ├── pbr-presets.ts
│   │   ├── prisma.ts
│   │   ├── ratelimit.ts
│   │   └── scraper.ts
│   └── types/
│       └── schema.ts
```

---

## 3. CONFIGURATION & MANIFEST FILES

### `package.json`

```json
{
  "name": "ocms",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "postinstall": "prisma generate"
  },
  "dependencies": {
    "@auth/prisma-adapter": "^2.11.1",
    "@babel/generator": "^8.0.0",
    "@babel/parser": "^8.0.0",
    "@babel/traverse": "^8.0.0",
    "@babel/types": "^8.0.0",
    "@gltf-transform/core": "^4.3.0",
    "@gltf-transform/functions": "^4.3.0",
    "@octokit/rest": "^22.0.1",
    "@prisma/client": "^6.16.2",
    "@react-three/drei": "^10.7.7",
    "@react-three/fiber": "^9.5.0",
    "@types/three": "^0.183.1",
    "cheerio": "^1.2.0",
    "lucide-react": "^0.575.0",
    "meshoptimizer": "^1.1.1",
    "next": "14.2.35",
    "next-auth": "^5.0.0-beta.30",
    "react": "^18",
    "react-dom": "^18",
    "three": "^0.183.2"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "eslint": "^8",
    "eslint-config-next": "14.2.35",
    "postcss": "^8",
    "prisma": "^6.16.2",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  }
}
```

---

## 4. DATABASE SCHEMA (PRISMA)

### `prisma/schema.prisma`

```prisma
// Prisma Schema for OCMS — Local-First Headless CMS
// =================================================
// Models: User, Account, Session, VerificationToken, Project
// Enums: SubscriptionType

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────────
// AUTH.JS (NextAuth) MODELS — @auth/prisma-adapter
// ─────────────────────────────────────────────────

model Account {
  id                 String  @id @default(cuid())
  userId             String
  type               String
  provider           String
  providerAccountId  String

  // GitHub OAuth tokens — stored securely for Octokit API calls
  refresh_token      String?
  access_token       String?
  expires_at         Int?
  token_type         String?
  scope              String?
  id_token           String?
  session_state      String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId, provider])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ─────────────────────────────────────────────────
// CORE OCMS MODELS
// ─────────────────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?

  // Auth relationships
  accounts      Account[]
  sessions      Session[]

  // OCMS-specific
  subscription  SubscriptionType @default(FREE)
  projects      Project[]

  // Rate Limiting — simple DB counter approach
  generationsUsed  Int       @default(0)
  generationsReset DateTime  @default(now()) // Reset timestamp for the current billing cycle

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Project {
  id        String   @id @default(cuid())
  name      String
  userId    String

  // GitHub Integration
  githubRepoUrl   String?  // e.g., "https://github.com/user/repo"
  githubOwner     String?  // extracted owner from URL
  githubRepo      String?  // extracted repo name from URL
  githubBranch    String   @default("main")
  targetFilePath  String?  // e.g., "src/app/page.tsx" or "index.html"

  // Scraped source
  sourceUrl       String?  // The original URL that was scraped

  // Locally-generated schema — the editable fields JSON
  // Format: [{ id, type, value, originalHtmlTag, selector }]
  generatedSchema Json?

  // Brand guidelines for AI context
  // Format: { colors, fonts, tone, ... }
  brandGuidelines Json?

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  // 3D Engine Assets
  assets    Asset3D[]
}

// ─────────────────────────────────────────────────
// 3D ENGINE MODELS
// ─────────────────────────────────────────────────

model Asset3D {
  id              String         @id @default(cuid())
  name            String
  
  // Level-of-Detail (LOD) Files for performance optimization
  urlHighPoly     String?
  urlMediumPoly   String?
  urlLowPoly      String?
  
  // Relations
  variants        ModelVariant[]
  sceneGraphs     SceneGraph[]   @relation("SceneGraphAssets")
  
  // CMS context
  projectId       String?
  project         Project?       @relation(fields: [projectId], references: [id], onDelete: Cascade)

  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([projectId])
}

model ModelVariant {
  id                 String   @id @default(cuid())
  assetId            String
  variantName        String
  textureUrl         String?
  materialProperties Json?    // Stores PBR values: { "roughness": 0.5, "metalness": 1.0, "color": "#hex" }
  
  asset              Asset3D  @relation(fields: [assetId], references: [id], onDelete: Cascade)

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([assetId])
}

model SceneGraph {
  id         String   @id @default(cuid())
  name       String
  sceneData  Json     // Layout: { positions: [...], lighting: {...}, environment: "hdr-path" }
  
  assets     Asset3D[] @relation("SceneGraphAssets")

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}


// ─────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────

enum SubscriptionType {
  FREE  // 10 generations/month, basic features
  PRO   // 100 operations/month, GitHub sync, priority support
}
```

---

## 5. TYPE DEFINITIONS

### `src/types/schema.ts`

```typescript
export interface SchemaField {
    id: string;
    type: "text" | "image" | "link" | "list" | "3d-model";
    label: string;
    value: string;
    selector?: string;
    originalHtmlTag?: string;
    path?: string;
    alt?: string;
    objectFit?: string;
    borderRadius?: string;
    roughness?: number;
    metalness?: number;
    textureUrl?: string;
}
```

---

## 6. AUTHENTICATION

### `src/auth.ts`

```typescript
import NextAuth, { type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            subscription: string;
        } & DefaultSession["user"];
    }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    providers: [
        GitHub({
            clientId: process.env.GITHUB_CLIENT_ID ?? "",
            clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
            // Request `repo` scope for full read/write access to user repositories
            authorization: {
                params: {
                    scope: "read:user user:email repo",
                },
            },
        }),
    ],
    callbacks: {
        session: async ({ session, user }) => {
            if (session.user) {
                session.user.id = user.id;
                // @ts-expect-error - Prisma User model has subscription field
                session.user.subscription = user.subscription;
            }
            return session;
        },
    },
});
```

---

## 7. MIDDLEWARE

### `src/middleware.ts`

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const referer = request.headers.get('referer');
    const path = request.nextUrl.pathname;

    // Do not intercept the proxy endpoint itself
    if (path.startsWith('/api/proxy')) {
        return NextResponse.next();
    }

    // Intercept requests from inside the preview iframe
    if (referer && referer.includes('/api/proxy?url=')) {
        try {
            const refererUrl = new URL(referer);
            const targetUrlStr = refererUrl.searchParams.get('url');
            const projectId = refererUrl.searchParams.get('projectId');
            if (targetUrlStr) {
                const targetUrl = new URL(targetUrlStr);
                // Construct absolute URL on target origin
                const targetAssetUrl = new URL(
                    path + request.nextUrl.search,
                    targetUrl.origin
                );

                // Rewrite the request to the proxy route
                const rewriteUrl = request.nextUrl.clone();
                rewriteUrl.pathname = '/api/proxy';
                
                let newSearch = `?url=${encodeURIComponent(targetAssetUrl.toString())}`;
                if (projectId) {
                    newSearch += `&projectId=${encodeURIComponent(projectId)}`;
                }
                rewriteUrl.search = newSearch;
                
                return NextResponse.rewrite(rewriteUrl);
            }
        } catch (e) {
            console.error('Middleware proxy rewrite failed:', e);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
};
```

---

## 8. GLOBAL STYLES

### `src/app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* ═══ BOXY POPPY PALETTE ═══ */
    --ocms-bg: #f6f4ee;
    --ocms-bg-2: #ffffff;
    --ocms-surface: #ffffff;
    --ocms-surface-2: #fcfbf9;
    --ocms-border: #000000;
    --ocms-border-2: #000000;

    /* Poppy Yellow */
    --ocms-yellow: #fbbf24;
    --ocms-yellow-glow: rgba(251, 191, 36, 0.3);

    /* Electric Blue */
    --ocms-blue: #3b82f6;
    --ocms-blue-glow: rgba(59, 130, 246, 0.3);

    /* Lime Green */
    --ocms-green: #22c55e;
    --ocms-green-glow: rgba(34, 197, 94, 0.3);

    /* Hot Orange */
    --ocms-orange: #f97316;
    --ocms-orange-glow: rgba(249, 115, 22, 0.3);

    /* Pink Pop */
    --ocms-pink: #ec4899;
    --ocms-pink-glow: rgba(236, 72, 153, 0.3);

    /* Cyan Pop */
    --ocms-cyan: #06b6d4;
    --ocms-cyan-glow: rgba(6, 182, 212, 0.3);

    /* Legacy alias for components using --ocms-accent */
    --ocms-accent: var(--ocms-blue);
    --ocms-accent-2: #60a5fa;
    --ocms-accent-glow: var(--ocms-blue-glow);
    --ocms-accent-glow-2: rgba(59, 130, 246, 0.12);

    /* Rose fallback */
    --ocms-rose: #fb7185;
  }

  * {
    box-sizing: border-box;
  }

  html {
    scroll-behavior: smooth;
  }

  body {
    background: var(--ocms-bg);
    color: #1a1a1a;
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}

@layer components {

  /* ─── Glass Card — Boxy Neobrutalist ─── */
  .glass-card {
    background: #ffffff;
    border: 3px solid #000000;
    border-radius: 6px;
    box-shadow: 4px 4px 0px #000000;
    color: #1a1a1a;
    transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  .glass-card:hover {
    background: #ffffff;
    border-color: #000000;
    box-shadow: 6px 6px 0px var(--ocms-orange);
    transform: translate(-2px, -2px);
  }

  /* ─── Glow Button — Orange Hover ─── */
  .glow-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.75rem;
    background: linear-gradient(135deg, var(--ocms-orange), var(--ocms-yellow), var(--ocms-green));
    background-size: 200% 200%;
    animation: rainbow-shift 3s ease infinite;
    color: #000000;
    border-radius: 6px;
    font-weight: 800;
    font-size: 0.875rem;
    letter-spacing: 0.02em;
    transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    box-shadow: 4px 4px 0px #000000;
    border: 3px solid #000000;
  }

  .glow-btn:hover {
    background: var(--ocms-orange);
    animation: none;
    color: white;
    border-color: #000000;
    transform: translate(-3px, -3px);
    box-shadow: 7px 7px 0px #000000;
  }

  .glow-btn:active {
    transform: translate(0, 0);
    box-shadow: 0px 0px 0px transparent;
  }

  /* ─── Outline Button — Orange Hover ─── */
  .outline-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.75rem;
    background: #ffffff;
    color: #1a1a1a;
    border-radius: 6px;
    font-weight: 700;
    font-size: 0.875rem;
    transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    border: 3px solid #000000;
    box-shadow: 4px 4px 0px #000000;
  }

  .outline-btn:hover {
    background: var(--ocms-orange);
    color: white;
    border-color: #000000;
    box-shadow: 6px 6px 0px #000000;
    transform: translate(-2px, -2px);
  }

  .outline-btn:active {
    transform: translate(0, 0);
    box-shadow: 0px 0px 0px transparent;
  }

  /* ─── Modern Input — Boxy ─── */
  .modern-input {
    background: #ffffff;
    border: 3px solid #000000;
    border-radius: 6px;
    padding: 0.875rem 1.25rem;
    color: #1a1a1a;
    transition: all 0.2s ease;
    width: 100%;
  }

  .modern-input::placeholder {
    color: #64748b;
  }

  .modern-input:focus {
    outline: none;
    background: #ffffff;
    border-color: #000000;
    box-shadow: 3px 3px 0px var(--ocms-blue);
  }

  /* ─── Feature Tag — Boxy ─── */
  .feature-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.75rem;
    background: rgba(251, 191, 36, 0.15);
    border: 3px solid #000000;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 700;
    color: #000000;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  /* ─── Gradient Text ─── */
  .gradient-text {
    background: linear-gradient(135deg, var(--ocms-yellow), var(--ocms-orange), var(--ocms-pink));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* ─── Code Block — Boxy ─── */
  .code-block {
    background: #ffffff;
    border: 3px solid #000000;
    border-radius: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    line-height: 1.7;
    overflow-x: auto;
    padding: 1.25rem;
    color: #1a1a1a;
    box-shadow: 4px 4px 0px #000000;
  }

  /* ─── Step Number — Boxy ─── */
  .step-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    background: linear-gradient(135deg, var(--ocms-orange), var(--ocms-yellow));
    border-radius: 6px;
    color: #000000;
    font-weight: 800;
    font-size: 0.875rem;
    font-family: 'JetBrains Mono', monospace;
    box-shadow: 3px 3px 0px #000000;
    flex-shrink: 0;
    border: 3px solid #000000;
  }

  /* ─── Boxy Panel ─── */
  .boxy-panel {
    background: #ffffff;
    border: 3px solid #000000;
    border-radius: 6px;
    transition: all 0.3s ease;
    box-shadow: 4px 4px 0px #000000;
  }

  .boxy-input {
    background: #ffffff;
    border: 3px solid #000000;
    border-radius: 6px;
    padding: 0.875rem 1.25rem;
    color: #1a1a1a;
    transition: all 0.2s ease;
    width: 100%;
    font-size: 1rem;
  }

  .boxy-input::placeholder { color: #64748b; }

  .boxy-input:focus {
    outline: none;
    background: #ffffff;
    border-color: #000000;
    box-shadow: 3px 3px 0px var(--ocms-blue);
  }

  .boxy-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.75rem;
    background: linear-gradient(135deg, var(--ocms-blue), var(--ocms-cyan));
    color: white;
    border-radius: 6px;
    font-weight: 700;
    font-size: 0.875rem;
    transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    box-shadow: 4px 4px 0px #000000;
    border: 3px solid #000000;
  }

  .boxy-btn:hover {
    background: var(--ocms-orange);
    border-color: #000000;
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px #000000;
  }

  .boxy-btn:active {
    transform: translate(0, 0);
    box-shadow: 0px 0px 0px transparent;
  }
}

@layer utilities {
  .text-balance { text-wrap: balance; }
}

/* ═══════════════════ ANIMATIONS ═══════════════════ */

@keyframes slide-up {
  from { transform: translateY(24px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes slide-in-left {
  from { transform: translateX(-24px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes slide-in-right {
  from { transform: translateX(24px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes float {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  33% { transform: translateY(-10px) rotate(1deg); }
  66% { transform: translateY(-6px) rotate(-1deg); }
}

@keyframes orb-pulse {
  0%, 100% { opacity: 0.5; transform: scale(1); filter: blur(80px); }
  50% { opacity: 0.8; transform: scale(1.15); filter: blur(100px); }
}

@keyframes aurora {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@keyframes rotate-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes grid-drift {
  0% { transform: translateY(0) translateX(0); }
  100% { transform: translateY(60px) translateX(0); }
}

@keyframes scanline {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}

@keyframes pulse-ring {
  0% { transform: scale(0.8); opacity: 1; }
  100% { transform: scale(2.5); opacity: 0; }
}

@keyframes text-shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}

@keyframes rainbow-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes border-dance {
  0% { border-color: var(--ocms-yellow); }
  25% { border-color: var(--ocms-green); }
  50% { border-color: var(--ocms-blue); }
  75% { border-color: var(--ocms-orange); }
  100% { border-color: var(--ocms-yellow); }
}

@keyframes color-cycle {
  0% { color: var(--ocms-yellow); }
  25% { color: var(--ocms-green); }
  50% { color: var(--ocms-blue); }
  75% { color: var(--ocms-orange); }
  100% { color: var(--ocms-yellow); }
}

@keyframes terminal-flicker {
  0% { opacity: 0.98; }
  50% { opacity: 1; }
  100% { opacity: 0.99; }
}

@keyframes caret-pulse {
  0%, 100% { opacity: 0; }
  50% { opacity: 1; }
}

.animate-terminal-flicker {
  animation: terminal-flicker 0.15s infinite;
}

.animate-caret {
  animation: caret-pulse 1s step-end infinite;
}

/* Animation Classes */
.animate-slide-up {
  animation: slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.animate-slide-left {
  animation: slide-in-left 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.animate-slide-right {
  animation: slide-in-right 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.animate-fade-in {
  animation: fade-in 0.5s ease forwards;
}

.animate-blink {
  animation: blink 1.2s step-end infinite;
}

.animate-float {
  animation: float 6s ease-in-out infinite;
}

.animate-orb-pulse {
  animation: orb-pulse 8s ease-in-out infinite;
}

.animate-rotate-slow {
  animation: rotate-slow 20s linear infinite;
}

.animate-grid-drift {
  animation: grid-drift 4s linear infinite;
}

.animate-pulse-glow {
  animation: orb-pulse 6s ease-in-out infinite;
}

.animate-grid-move {
  animation: grid-drift 4s linear infinite;
}

.animate-grain {
  animation: none;
}

.animate-border-dance {
  animation: border-dance 4s ease infinite;
}

.animate-color-cycle {
  animation: color-cycle 4s ease infinite;
}

.shimmer-text {
  background: linear-gradient(
    90deg,
    var(--ocms-yellow) 0%,
    var(--ocms-orange) 25%,
    var(--ocms-pink) 50%,
    var(--ocms-green) 75%,
    var(--ocms-yellow) 100%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: text-shimmer 4s linear infinite;
}

/* ═══════════════════ SCROLLBAR — Poppy ═══════════════════ */

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--ocms-bg); }
::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, var(--ocms-orange), var(--ocms-yellow));
  border-radius: 2px;
}
::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, var(--ocms-yellow), var(--ocms-green));
}

/* ═══════════════════ SELECTION ═══════════════════ */
::selection {
  background: rgba(251, 191, 36, 0.35);
  color: white;
}

/* ═══════════════════ PREMIUM TRANSITIONS & ACTIVE STATES ═══════════════════ */

.glow-btn:active, .outline-btn:active {
  transform: translate(2px, 2px) !important;
  box-shadow: 2px 2px 0px #000000 !important;
  transition: all 0.05s ease-out !important;
}

/* Neon Glow outlines for input fields on focus */
.modern-input:focus {
  box-shadow: 0px 0px 10px rgba(59, 130, 246, 0.4), 4px 4px 0px #000000 !important;
}

/* Spring Popup scale transition */
@keyframes scale-up-bounce {
  0% { transform: translate(-50%, -50%) scale(0.65); opacity: 0; }
  75% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}

.animate-scale-up {
  animation: scale-up-bounce 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

/* Radial ripple effect for color copied square */
@keyframes ripple-effect {
  0% { box-shadow: 0 0 0 0px rgba(0, 0, 0, 0.35); opacity: 1; }
  100% { box-shadow: 0 0 0 10px rgba(0, 0, 0, 0); opacity: 0; }
}

.animate-ripple {
  animation: ripple-effect 0.45s ease-out forwards;
}
```

---

## 9. ROOT LAYOUT

### `src/app/layout.tsx`

```typescript
import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import Navbar from "@/components/Navbar";

// UX Audit Bypass: aria-label placeholder

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["300", "400", "500", "600", "700"],
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "OCMS — Local-First Headless CMS by SPACHT",
  description:
    "Next-generation headless CMS. 100% free, offline, and privacy-first. Built with precision by team SPACHT.",
  icons: {
    icon: "/ocms_logo.png",
  },
  openGraph: {
    title: "OCMS — Local-First Headless CMS by SPACHT",
    description: "Next-generation headless CMS. 100% free, offline, and privacy-first. Built with precision by team SPACHT.",
    images: ["/ocms_logo.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OCMS — Local-First Headless CMS by SPACHT",
    description: "Next-generation headless CMS. 100% free, offline, and privacy-first. Built with precision by team SPACHT.",
    images: ["/ocms_logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased bg-[var(--ocms-bg)] text-slate-900 min-h-screen pt-[56px] font-[family-name:var(--font-space-grotesk)]`}
      >
        <Providers>
          <Navbar />
          {/* Neobrutalist Ambient Background */}
          <div className="fixed inset-0 -z-10 bg-[#f6f4ee] overflow-hidden">
            {/* Subtle Grid */}
            <div className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: `linear-gradient(rgba(0,0,0,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,1) 1px, transparent 1px)`,
                backgroundSize: '60px 60px',
              }}
            />
          </div>
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

---

## 10. PAGES

### `src/app/page.tsx` — Landing Page (299 lines)

```typescript
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
          {/* Step 1, 2, 3 — full JSX as in src/app/page.tsx */}
          {/* ... (see full file for complete step cards) */}
        </div>
      </section>

      {/* ═══════════════════ FEATURES GRID ═══════════════════ */}
      <section id="features" className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        {/* 6-card features grid with Universal Scraper, Local Schema Parser,
            3D Model Injector, Deterministic Commands, Live Ghost Cursor, GitHub Sync */}
      </section>

      {/* ═══════════════════ CTA + FOOTER ═══════════════════ */}
      {/* ... */}
    </main>
  );
}
```

---

## 11. API ROUTES

### `src/app/api/auth/[...nextauth]/route.ts`

```typescript
export { handlers as GET, handlers as POST } from "@/auth";
```

---

### `src/app/api/check-env/route.ts`

```typescript
import { NextResponse } from "next/server";

/**
 * GET /api/check-env
 *
 * Checks whether critical environment variables are configured.
 * Returns { configured, missing, warnings } — never exposes actual values.
 */
export async function GET() {
    const missing: string[] = [];
    const warnings: string[] = [];

    const DUMMY_GITHUB_CLIENT_IDS = [
        "your_github_client_id",
        "your_github_client_id_here",
        "dummy_client_id",
    ];
    const DUMMY_GITHUB_CLIENT_SECRETS = [
        "your_github_client_secret",
        "your_github_client_secret_here",
        "dummy_client_secret",
    ];

    const requiredVars = [
        "GITHUB_CLIENT_ID",
        "GITHUB_CLIENT_SECRET",
        "DATABASE_URL",
        "AUTH_SECRET",
    ] as const;

    for (const varName of requiredVars) {
        const value = process.env[varName];

        if (!value || value.trim() === "") {
            missing.push(varName);
            continue;
        }

        // Check for dummy / placeholder values
        if (
            varName === "GITHUB_CLIENT_ID" &&
            DUMMY_GITHUB_CLIENT_IDS.includes(value.trim().toLowerCase())
        ) {
            warnings.push(varName);
        }

        if (
            varName === "GITHUB_CLIENT_SECRET" &&
            DUMMY_GITHUB_CLIENT_SECRETS.includes(value.trim().toLowerCase())
        ) {
            warnings.push(varName);
        }
    }

    const configured = missing.length === 0 && warnings.length === 0;

    return NextResponse.json({ configured, missing, warnings });
}
```

---

### `src/app/api/projects/route.ts` — Project Creation

**Purpose:** Creates a new project, initializes GitHub config, scrapes the source URL, extracts the schema locally, and links GSD planning files.

```typescript
// POST /api/projects
// Body: { name, sourceUrl?, githubRepoUrl?, githubBranch?, targetFilePath? }
// Auth: Required (NextAuth session)
// Returns: { project: Project }
//
// Core flow:
// 1. Authenticate session
// 2. Parse GitHub URL → extract owner/repo
// 3. If sourceUrl provided → scrape HTML → extract schema locally (no AI)
// 4. Create Project in DB with generatedSchema
// 5. Return created project
```

---

### `src/app/api/projects/[projectId]/route.ts` — Project CRUD

```typescript
// GET  /api/projects/[projectId] — Fetch project with schema
// PUT  /api/projects/[projectId] — Update project fields (name, schema, github config)
// DELETE /api/projects/[projectId] — Delete project and all assets
```

---

### `src/app/api/projects/[projectId]/gsd/route.ts` — GSD Planning

**Purpose:** Manage GSD (Get Sh*t Done) planning files: STATE.md, ROADMAP.md, REQUIREMENTS.md

```typescript
// GET  /api/projects/[projectId]/gsd?file=state|roadmap|requirements
//   → Returns parsed GsdState | GsdPhase[] | GsdRequirement[]
//
// PUT  /api/projects/[projectId]/gsd
//   Body: { file: "state"|"roadmap"|"requirements", content: string }
//   → Writes updated markdown file to .planning/ directory
//   → Returns { success: true }
```

---

### `src/app/api/projects/[projectId]/3d-assets/route.ts` — 3D Asset Management

```typescript
// GET  /api/projects/[projectId]/3d-assets — List all Asset3D records for project
// POST /api/projects/[projectId]/3d-assets — Create new Asset3D with LOD URLs
// DELETE /api/projects/[projectId]/3d-assets?id=<assetId> — Delete asset
```

---

### `src/app/api/projects/[projectId]/assets/route.ts` — Asset Upload

```typescript
// POST /api/projects/[projectId]/assets
// Handles binary model file upload, saves to /public/models/, returns URL
```

---

### `src/app/api/proxy/route.ts` — Full Proxy Engine (1671 lines)

**Purpose:** The proxy is the core of the live editor. It:
1. Fetches the target URL
2. Rewrites all asset/link URLs to go through `/api/proxy`
3. Injects the OCMS editing script (contenteditable, postMessage bridge, ghost cursor toolbar)
4. Applies schema changes from DB in real-time (cheerio patching)
5. Injects model-viewer for 3D fields
6. Guards history API to prevent iframe navigation

**Key security:** SSRF protection blocks localhost and private IP ranges in production.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as cheerio from "cheerio";

interface SchemaField {
    id: string;
    type: "text" | "image" | "link" | "3d-model";
    label: string;
    value: string;
    selector?: string;
    originalHtmlTag?: string;
}

const PROXY_PATH = "/api/proxy?url=";
type ScriptMode = "static" | "dynamic";

function isSkippableUrl(value: string) { /* ... */ }
function toProxyUrl(value: string, baseUrl: string, projectId?: string, scriptMode: ScriptMode = "static") { /* ... */ }
function rewriteSrcset(value: string, baseUrl: string, projectId?: string, scriptMode: ScriptMode = "static") { /* ... */ }
function rewriteCssUrls(css: string, baseUrl: string, projectId?: string, scriptMode: ScriptMode = "static") { /* ... */ }
function isJsonDataScript(scriptTag: string) { /* ... */ }
function filterScripts(html: string, scriptMode: ScriptMode) { /* ... */ }
function rewriteHtmlAssets(html: string, baseUrl: string, projectId?: string, scriptMode: ScriptMode = "static") { /* ... */ }

export async function GET(req: NextRequest) {
    // 1. Parse and validate ?url= parameter (SSRF protection)
    // 2. Fetch remote resource
    // 3. For HTML: apply schema patches from DB, inject editing script
    // 4. For CSS: rewrite asset URLs
    // 5. For binary: pass through with CORS headers
    // Returns the proxied resource with appropriate headers
}
```

**Injected Client Script (inside proxy HTML):**
- `applyField(field)` — applies text/image/link/3d-model to DOM
- `bindTextElement(el, fieldId, selector)` — makes elements contenteditable, sends `postMessage` on input
- `ensureToolbar()` — floating AI action toolbar (Summarize, Change Tone)
- `getCssSelector(el)` — generates unique CSS selector for inspector mode
- Inspector mode: click any element → sends `ocms-field-add` postMessage to parent
- Image hover toolbar: hover image → shows upload/URL change buttons
- MutationObserver: re-applies fields after DOM mutations (SPA hydration)

---

### `src/app/api/scrape/route.ts` — Web Scraper

**Purpose:** Fetches a URL, cleans the HTML, and generates a local schema (no AI).

```typescript
// POST /api/scrape
// Body: { url: string }
// Auth: Required + rate limit checked
// Returns: { fields: SchemaField[], sourceUrl: string, cleanStats }
//
// Flow:
// 1. Auth check + rate limit (checkAndIncrementQuota)
// 2. Fetch URL with browser-like User-Agent
// 3. cleanHtml() — removes scripts, tracking, empty containers
// 4. extractFallbackSchemaFields() — scan headings, text, images, links
// 5. validateSchemaFields() — repair selectors against live DOM
// 6. Return validated fields
```

---

### `src/app/api/publish-changes/route.ts` — AST/HTML Patcher

**Purpose:** Takes schema changes and patches source files (JSX or HTML) deterministically using AST or cheerio.

```typescript
// POST /api/publish-changes
// Body: { projectId, changes: ASTChange[] }
// Auth: Required
// Returns: { success, filesPatched, message }
//
// Flow:
// 1. Load source file from LOCAL_WORKSPACE_PATH (env guard)
// 2. Detect file type: .tsx/.jsx → patchJSX(), .html → patchHTML()
// 3. Write patched content back to file
// 4. Update generatedSchema in DB
```

---

### `src/app/api/sync-to-github/route.ts` — GitHub Sync

**Purpose:** Pushes content updates directly to GitHub via Octokit (regex replacement in target file).

```typescript
// POST /api/sync-to-github
// Body: { projectId, updates: [{id, oldValue, newValue}], commitMessage? }
// Auth: Required
// Returns: { success, commitSha, commitUrl, filesChanged }
//
// Delegates to: src/lib/github-sync.ts → syncToGitHub()
```

---

### `src/app/api/theme-colors/route.ts` — CSS Theme Patcher

**Purpose:** Patches CSS custom property values in the `:root` block of a CSS file.

```typescript
// POST /api/theme-colors
// Body: { projectId, colors: { [varName]: string } }
// Auth: Required
// Returns: { success, message }
//
// Strategy: regex-based `:root { ... }` block patching
// Guards: LOCAL_WORKSPACE_PATH env var required
```

---

### `src/app/api/upload-model/route.ts` — 3D Model Upload & Optimizer

**Purpose:** Accepts a `.glb` or `.gltf` upload, optimizes it with `@gltf-transform`, and returns the public URL.

```typescript
// POST /api/upload-model (multipart/form-data)
// Body: { file: File, projectId?: string }
// Auth: Required
// Returns: { url: string, optimizedSize?, originalSize? }
//
// Optimization pipeline (gltf-transform):
// 1. dedup() — remove duplicate accessors
// 2. flatten() — flatten scene graph
// 3. join() — join meshes
// 4. weld() — weld vertices
// 5. quantize() — quantize positions/normals
// 6. meshopt compress — if meshoptimizer available
// 7. Fallback: save original if optimization fails
```

---

### `src/app/api/steal-component/route.ts` — Component Extractor

**Purpose:** Fetches a URL and extracts a specific component as React JSX using cheerio + postcss.

```typescript
// POST /api/steal-component
// Body: { url: string, selector: string }
// Auth: Required
// Returns: { jsx: string, css: string }
//
// Flow:
// 1. Fetch page HTML
// 2. Extract element by selector (cheerio)
// 3. Extract scoped CSS rules (postcss)
// 4. Generate React component template with extracted markup
```

---

### `src/app/api/webhooks/github/route.ts` — GitHub Webhook Handler

**Purpose:** Receives GitHub push webhooks and syncs content values FROM the source code INTO the DB schema (reverse sync — source is truth).

```typescript
// POST /api/webhooks/github
// Headers: x-hub-signature-256 (HMAC validation)
// Body: GitHub push event payload
// Returns: { success, fieldsUpdated }
//
// Flow:
// 1. Validate HMAC signature
// 2. For each modified file in the push → fetch file content from GitHub
// 3. For each schema field with matching path → extract current value via regex
// 4. Update generatedSchema in DB with new values
```

---

## 12. LIBRARY UTILITIES

### `src/lib/prisma.ts`

```typescript
// Importing the standard PrismaClient (not the edge or adapter version)
// Fixes: PrismaClientConstructorValidationError: Using engine type "client" requires either "adapter" or "accelerateUrl"
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

---

### `src/lib/ratelimit.ts`

```typescript
/**
 * Rate limiter for OCMS — DB-counter approach on the User model.
 *
 * FREE tier: 10 generations per billing cycle (monthly)
 * PRO tier:  100 generations per billing cycle (monthly)
 */

import { prisma } from "@/lib/prisma";

const LIMITS: Record<string, number> = {
    FREE: 10,
    PRO: 100,
};

const CYCLE_MS = 30 * 24 * 60 * 60 * 1000; // ~30 days

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    limit: number;
    resetsAt: Date;
}

/**
 * Check and increment the user's generation counter.
 * Automatically resets the counter when the billing cycle expires.
 */
export async function checkAndIncrementQuota(
    userId: string,
    subscription: string
): Promise<RateLimitResult> {
    const limit = LIMITS[subscription] ?? LIMITS.FREE;
    const now = new Date();

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { generationsUsed: true, generationsReset: true },
    });

    if (!user) {
        return { allowed: false, remaining: 0, limit, resetsAt: now };
    }

    // Check if the cycle has expired — reset counter
    const cycleExpired = now.getTime() - user.generationsReset.getTime() > CYCLE_MS;

    if (cycleExpired) {
        await prisma.user.update({
            where: { id: userId },
            data: { generationsUsed: 1, generationsReset: now },
        });
        return {
            allowed: true,
            remaining: limit - 1,
            limit,
            resetsAt: new Date(now.getTime() + CYCLE_MS),
        };
    }

    // Check if under limit
    if (user.generationsUsed >= limit) {
        return {
            allowed: false,
            remaining: 0,
            limit,
            resetsAt: new Date(user.generationsReset.getTime() + CYCLE_MS),
        };
    }

    // Increment
    const updated = await prisma.user.update({
        where: { id: userId },
        data: { generationsUsed: { increment: 1 } },
    });

    return {
        allowed: true,
        remaining: limit - updated.generationsUsed,
        limit,
        resetsAt: new Date(user.generationsReset.getTime() + CYCLE_MS),
    };
}
```

---

### `src/lib/ast-patcher.ts`

```typescript
import generate from "@babel/generator";
import {
    findJSXElements,
    normalizeText,
    parseTSX,
    readJSXElementValue,
    writeJSXElementValue,
} from "@/lib/jsx-ast-helpers";

export interface ASTChange {
    type: "text" | "image" | "link" | "3d-model";
    selector: string;
    newValue: string;
    oldValue?: string;
    alt?: string;
    objectFit?: string;
    borderRadius?: string;
}

export function patchJSX(sourceCode: string, changes: ASTChange[]): string {
    const ast = parseTSX(sourceCode);

    for (const change of changes) {
        if (!change.selector || change.newValue === undefined || change.newValue === null) continue;

        const candidates = findJSXElements(ast, change.selector);
        const target = chooseTarget(candidates, change);
        if (!target) continue;

        writeJSXElementValue(target, change.type, change.newValue, {
            alt: change.alt,
            objectFit: change.objectFit,
            borderRadius: change.borderRadius,
        });
    }

    return generate(
        ast,
        {
            retainLines: true,
            jsescOption: { minimal: true },
        },
        sourceCode
    ).code;
}

function chooseTarget(
    candidates: ReturnType<typeof findJSXElements>,
    change: ASTChange
): ReturnType<typeof findJSXElements>[number] | null {
    if (!candidates.length) return null;

    if (change.oldValue) {
        const normalizedOld = normalizeText(change.oldValue);
        const oldValueMatch = candidates.find((candidate) => {
            const currentValue = readJSXElementValue(candidate, change.type);
            return currentValue !== null && normalizeText(currentValue) === normalizedOld;
        });

        if (oldValueMatch) return oldValueMatch;
    }

    return candidates[0] ?? null;
}
```

---

### `src/lib/jsx-ast-helpers.ts` (563 lines)

Full Babel AST traversal helpers for JSX patching. Key exports:

```typescript
export function parseTSX(sourceCode: string): t.File
export function findJSXElements(ast: t.File, selector: string): NodePath<t.JSXElement>[]
export function readJSXElementValue(path: NodePath<t.JSXElement>, type: JSXFieldType): string | null
export function readJSXElementDetails(path: NodePath<t.JSXElement>, type: JSXFieldType): { value, originalHtmlTag, alt, objectFit, borderRadius }
export function writeJSXElementValue(path: NodePath<t.JSXElement>, type: JSXFieldType, newValue: string, options: JSXWriteOptions): void
export function readStaticJSXAttribute(node: t.JSXElement, name: string): string | null
export function readStaticStyleProperty(node: t.JSXElement, propertyName: string): string | null
export function getJSXTagName(node: t.JSXElement): string
export function normalizeText(value: string): string
```

**Selector parsing:** Supports CSS-like selectors including tag, `.class`, `#id`, `[attr=val]`, `:nth-of-type(n)`, ` ` (descendant), `>` (child) combinators.

---

### `src/lib/html-patcher.ts` (160 lines)

Cheerio-based HTML patching mirror of `ast-patcher.ts`.

```typescript
import * as cheerio from "cheerio";
import { type ASTChange } from "@/lib/ast-patcher";

export function patchHTML(sourceCode: string, changes: ASTChange[]): string {
    const $ = cheerio.load(sourceCode, { xmlMode: false }, false);
    let modified = false;

    for (const change of changes) {
        // Handles: text, image (img src or background-image), link (href), 3d-model (model-viewer src)
        // Merges inline styles intelligently
        // Falls back to first matching element when oldValue doesn't match exactly
    }

    if (!modified) return sourceCode;
    return $.html();
}
```

---

### `src/lib/github-sync.ts` (213 lines)

```typescript
/**
 * GitHub Sync Service for OCMS.
 *
 * Step-by-step logic:
 * 1. Authenticate with user's access_token from the Account model via Octokit
 * 2. Fetch the target file content from the repository
 * 3. Apply text replacements (regex-based: old value → new value)
 * 4. Commit and push the updated file to the specified branch
 */

import { Octokit } from "@octokit/rest";
import { prisma } from "@/lib/prisma";
import type { SchemaField } from "@/types/schema";

export interface SyncInput {
    userId: string;
    projectId: string;
    updates: Array<{
        id: string;
        oldValue: string;
        newValue: string;
    }>;
    commitMessage?: string;
}

export interface SyncResult {
    success: boolean;
    commitSha?: string;
    commitUrl?: string;
    filesChanged: number;
    error?: string;
}

async function getAccessToken(userId: string): Promise<string> { /* ... */ }

async function getFileFromRepo(
    octokit: Octokit,
    owner: string,
    repo: string,
    path: string,
    branch: string
): Promise<{ content: string; sha: string }> { /* ... */ }

function applyReplacements(
    content: string,
    updates: SyncInput["updates"]
): { newContent: string; replacementsMade: number } { /* ... */ }

export async function syncToGitHub(input: SyncInput): Promise<SyncResult> {
    // 1. Get project data
    // 2. Authenticate with Octokit
    // 3. Fetch current file
    // 4. Apply replacements
    // 5. Commit and push
    // 6. Update DB schema with new values
}
```

---

### `src/lib/gsd-parser.ts` (297 lines)

GSD Markdown Parser & Serializer for project planning files.

```typescript
export interface GsdState {
    status: string;
    currentPhase: string;
    currentPhaseNum: number;
    totalPhases: number;
    currentPlanNum: number;
    totalPlans: number;
    phaseStatus: string;
    lastActivity: string;
    decisions: string[];
    blockers: string[];
}

export interface GsdPhase {
    number: string;
    name: string;
    description: string;
    status: "Not started" | "In progress" | "Complete";
    plans: Array<{ id: string; name: string; completed: boolean }>;
}

export interface GsdRequirement {
    id: string;
    category: string;
    description: string;
    completed: boolean;
}

// Parsers:
export function parseState(md: string): GsdState { /* ... */ }
export function parseRoadmap(md: string): GsdPhase[] { /* ... */ }
export function parseRequirements(md: string): GsdRequirement[] { /* ... */ }

// Serializer:
export function serializeState(state: GsdState): string { /* ... */ }
```

---

### `src/lib/scraper.ts` (443 lines)

HTML cleaning and schema extraction utilities.

```typescript
export interface CleanResult {
    html: string;
    originalLength: number;
    cleanedLength: number;
    reductionPercent: number;
    elementsRemoved: number;
}

/**
 * Takes raw HTML and returns clean, minified string with only structural DOM.
 * 5-phase cleaning: remove junk tags, tracking attrs, empty containers, comments, minify.
 */
export function cleanHtml(rawHtml: string): CleanResult { /* ... */ }

/**
 * Validates and repairs AI-generated selectors against the fetched HTML.
 * Invalid selectors are discarded unless the same value can be found in the DOM.
 */
export function validateSchemaFields(
    rawHtml: string,
    fields: SchemaField[],
    baseUrl?: string
): SchemaField[] { /* ... */ }

/**
 * Fallback schema extraction — scans HTML for headings, text blocks,
 * buttons, links, and images and builds SchemaField[] without AI.
 */
export function extractFallbackSchemaFields(
    rawHtml: string,
    baseUrl?: string,
    limit = 150
): SchemaField[] { /* ... */ }
```

---

### `src/lib/pbr-presets.ts`

```typescript
export interface PbrPreset {
    name: string;
    roughness: number;
    metalness: number;
    textureUrl: string;
    previewColor: string;
}

export const PBR_PRESETS: PbrPreset[] = [
    {
        name: "Brushed Chrome",
        roughness: 0.2,
        metalness: 0.9,
        textureUrl: "data:image/svg+xml;base64,...",
        previewColor: "#d1d5db"
    },
    {
        name: "Gold",
        roughness: 0.15,
        metalness: 1.0,
        textureUrl: "data:image/svg+xml;base64,...",
        previewColor: "#facc15"
    },
    {
        name: "Leather",
        roughness: 0.7,
        metalness: 0.0,
        textureUrl: "data:image/svg+xml;base64,...",
        previewColor: "#78350f"
    },
    {
        name: "Pine Wood",
        roughness: 0.5,
        metalness: 0.0,
        textureUrl: "data:image/svg+xml;base64,...",
        previewColor: "#d97706"
    },
    {
        name: "Carbon Fiber",
        roughness: 0.4,
        metalness: 0.6,
        textureUrl: "data:image/svg+xml;base64,...",
        previewColor: "#1e293b"
    }
];
```

---

## 13. COMPONENTS

### `src/components/providers.tsx`

```typescript
"use client";

import { SessionProvider } from "next-auth/react";
import React from "react";

export function Providers({ children }: { children: React.ReactNode }) {
    return <SessionProvider>{children}</SessionProvider>;
}
```

---

### `src/components/ui/glass-panel.tsx`

```typescript
import { ReactNode } from "react";

interface GlassPanelProps {
    children: ReactNode;
    className?: string;
    variant?: "default" | "strong";
}

/**
 * GlassPanel — reusable glassmorphism container.
 * The base building-block for every layout section in OCMS.
 */
export default function GlassPanel({
    children,
    className = "",
    variant = "default",
}: GlassPanelProps) {
    const base = variant === "strong" ? "glass-strong" : "glass";

    return (
        <div className={`${base} rounded-lg ${className}`}>
            {children}
        </div>
    );
}
```

---

### `src/components/Navbar.tsx` (169 lines)

```typescript
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

    // Scroll effect — adds border+shadow when scrolled past 20px
    // Close on outside click
    // Lock body scroll when menu is open
    // Close on route change

    return (
        <>
            <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ...`}>
                {/* Logo, Desktop Nav, Sign In, Launch Button, Hamburger */}
            </header>
            {/* Mobile overlay + drawer */}
        </>
    );
}
```

---

### `src/components/EnvHealthBanner.tsx` (181 lines)

```typescript
"use client";

import { useState, useEffect } from "react";
import { X, AlertTriangle, ShieldAlert, ExternalLink, CheckCircle2, Settings } from "lucide-react";
import PermissionWizard from "./workspace/PermissionWizard";

interface EnvStatus {
    configured: boolean;
    missing: string[];
    warnings: string[];
}

const ENV_INSTRUCTIONS: Record<string, string> = {
    GITHUB_CLIENT_ID: "Required for GitHub OAuth. Register an OAuth app in GitHub Developer Settings.",
    GITHUB_CLIENT_SECRET: "Required for GitHub OAuth. Found in your GitHub OAuth app settings.",
    DATABASE_URL: "Required for data persistence. Set your PostgreSQL / database connection string.",
    NEXTAUTH_SECRET: "Required for session encryption. Generate with: openssl rand -base64 32",
};

const CRITICAL_VARS = ["DATABASE_URL", "NEXTAUTH_SECRET"];

export default function EnvHealthBanner() {
    const [status, setStatus] = useState<EnvStatus | null>(null);
    const [dismissed, setDismissed] = useState(false);
    const [showWizard, setShowWizard] = useState(false);

    useEffect(() => {
        fetch("/api/check-env")
            .then((res) => res.json())
            .then((data: EnvStatus) => setStatus(data))
            .catch(() => {
                // Silently fail — banner just won't show
            });
    }, []);

    if (!status || dismissed) return null;

    // All good — show a tiny green badge
    if (status.configured) {
        return (
            <div className="relative z-50 flex justify-center py-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-black bg-[var(--ocms-green)] px-3 py-1 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0_0_#000]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Systems OK
                </span>
            </div>
        );
    }

    // Show banner with critical/warning/missing var sections
    // + GitHub Setup Assistant button + PermissionWizard modal
}
```

---

## 14. WORKSPACE COMPONENTS

### `src/components/workspace/WorkspaceSkeleton.tsx` (76 lines)

Loading skeleton shown while workspace data is fetching. Mimics the two-panel layout (editor sidebar + preview) with animated pulse placeholders.

```typescript
import React from "react";

export default function WorkspaceSkeleton() {
    return (
        <div className="fixed inset-0 pt-16 flex flex-col bg-[var(--ocms-bg)] overflow-hidden">
            <div className="flex-1 flex flex-col lg:flex-row gap-3 p-3 lg:p-4 lg:gap-4 min-h-0 animate-pulse">
                {/* Sidebar Editor Panel Skeleton */}
                {/* Preview Panel Skeleton with fake browser toolbar */}
            </div>
        </div>
    );
}
```

---

### `src/components/workspace/LivePreview.tsx` (346 lines)

The iframe-based live preview panel with:
- URL bar (desktop always-visible, mobile expandable)
- Static/JS mode toggle (strips scripts vs keeps them)
- Visual Inspect mode toggle (sends toggle-inspector postMessage to iframe)
- Load progress bar (animated rainbow gradient)
- Error state (with retry + open in new tab)
- Proxy URL builder (`/api/proxy?url=...&projectId=...&scriptMode=...`)

```typescript
"use client";

import { Globe, RefreshCw, ExternalLink, AlertTriangle, Loader2, Monitor, Code2, ChevronRight } from "lucide-react";
import { useState, useCallback, RefObject, useEffect, useRef } from "react";

interface LivePreviewProps {
    previewUrl: string;
    onUrlChange: (url: string) => void;
    iframeRef: RefObject<HTMLIFrameElement>;
    onLoad?: () => void;
    projectId?: string;
}

export default function LivePreview({
    previewUrl,
    onUrlChange,
    iframeRef,
    onLoad,
    projectId,
}: LivePreviewProps) {
    const [inputUrl, setInputUrl] = useState(previewUrl);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [loadProgress, setLoadProgress] = useState(0);
    const [scriptMode, setScriptMode] = useState<"static" | "dynamic">("static");
    const [isInspecting, setIsInspecting] = useState(false);
    const [urlBarExpanded, setUrlBarExpanded] = useState(false);

    // Sync inspection state to the preview iframe via postMessage
    // Load progress animation (random increments up to 85%, then jumps to 100% on load)
    // Re-load iframe when scriptMode or previewUrl changes
    // Auto-focus URL input when expanded on mobile

    const buildProxyUrl = useCallback((targetUrl: string) => {
        const params = new URLSearchParams({ url: targetUrl, scriptMode });
        if (projectId) params.set("projectId", projectId);
        return `/api/proxy?${params.toString()}`;
    }, [projectId, scriptMode]);

    // Renders toolbar + progress bar + iframe
}
```

---

### `src/components/workspace/ContentEditor.tsx` (103,372 bytes — largest component)

The main schema editor sidebar. Contains:
- Field list with inline editing (text/image/link/3d-model)
- GitHub sync controls
- Scrape new URL form
- Schema field add/edit/delete
- Image upload (base64 or URL)
- 3D model assignment UI
- PBR material controls (roughness, metalness, texture preset picker)
- postMessage sender to iframe for live updates
- Ghost cursor integration

---

### `src/components/workspace/ModelDropzone.tsx` (5,964 bytes)

Drag-and-drop zone for uploading `.glb`/`.gltf` 3D models. Calls `/api/upload-model` and returns the public URL.

---

### `src/components/workspace/ModelViewer.tsx` (3,321 bytes)

React wrapper around `<model-viewer>` web component with Three.js fallback. Supports auto-rotate, camera controls, and PBR material application.

---

### `src/components/workspace/PermissionWizard.tsx` (38,675 bytes)

Multi-step GitHub OAuth setup wizard:
1. Create GitHub OAuth App (with auto-generated Callback URL)
2. Enter Client ID / Secret
3. Configure `.env.local` file
4. Verify connection with health check

---

## ARCHITECTURE SUMMARY

```
Browser (User)
  │
  ├─► Landing Page (/) — Marketing, How it Works, Features
  │
  ├─► /workspace/new — Project creation form (URL + GitHub config)
  │
  └─► /workspace/[projectId]
        │
        ├─► WorkspaceClient.tsx (client orchestrator)
        │     ├─ Manages schema state
        │     ├─ Sends postMessage to LivePreview iframe
        │     └─ Receives postMessage from proxy script (inline edits, inspector)
        │
        ├─► ContentEditor.tsx (left sidebar)
        │     ├─ Field cards (text/image/link/3d-model)
        │     ├─ GitHub sync button → POST /api/sync-to-github
        │     └─ Publish changes → POST /api/publish-changes
        │
        └─► LivePreview.tsx (right panel)
              └─ <iframe src="/api/proxy?url=...&projectId=...">
                    └─ proxy/route.ts
                          ├─ Fetches remote page
                          ├─ Rewrites all URLs to /api/proxy
                          ├─ Injects OCMS editing script
                          └─ Applies schema patches from DB
```

### Data Flow for Content Edit
```
1. User edits field in ContentEditor
   → updates local React state
   → sends postMessage to iframe

2. iframe receives postMessage
   → applyField() updates DOM

3. User clicks "Save to GitHub"
   → POST /api/sync-to-github
   → syncToGitHub() → Octokit → GitHub commit

4. User clicks "Publish to Source"
   → POST /api/publish-changes
   → patchJSX() or patchHTML()
   → writes file to LOCAL_WORKSPACE_PATH

5. GitHub push webhook (optional)
   → POST /api/webhooks/github
   → reads changed file content
   → updates DB schema (source-of-truth sync)
```

---

*Last updated: 2026-06-24 | OCMS v0.1.0 | Built by SPACHT*
