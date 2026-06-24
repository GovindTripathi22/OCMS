# OCMS — Local-First Headless CMS

OCMS is a next-generation, local-first, privacy-respecting headless CMS designed for developers who want a seamless visual editing experience without relying on external AI services. Featuring a deterministic AST-patcher and a live synchronized editing interface, OCMS allows you to edit frontend pages visually and sync changes directly back to your source code repository.

---

## 🚀 Key Features

*   **Deterministic AST-Patcher**: Safely and accurately parses, inspects, and patches local page files (like React/Next.js files) without breaking imports, comments, or formatting.
*   **Live Ghost Cursor**: A real-time, overlay-based visual editor that mirrors edits and provides direct visual feedback as you customize elements.
*   **3D Model Integration**: Dynamic support for 3D elements inside your content fields using a built-in `<model-viewer>` interface, complete with PBR material presets (gold, wood, metal, plastic) and sliders.
*   **Copywriting Tone Engine**: Generate local A/B variations of text fields across various tones (technical, minimalist, playful) directly from local dictionary files.
*   **Semantic Color Extractor**: Intelligently maps brand keywords (like "finance", "sustainability", "startup") to curated design palettes for immediate UI branding matching.
*   **IDOR Protection & Multi-User Auth**: Authenticated workspaces that prevent unauthorized database updates or cross-user project tampering.

---

## 🛠️ Tech Stack

*   **Framework**: Next.js 14+ (App Router)
*   **Database**: Prisma ORM with SQLite (local-first storage)
*   **SDK Package**: Built-in visual helper package (`packages/ghost-cursor`) compiled with `tsup`
*   **Styling**: Neobrutalist design theme built with custom HSL variables and Tailwind CSS

---

## ⚙️ Environment Configuration

Create a `.env` (or `.env.local`) file in the root directory. You can use the following variables:

```bash
# Database connection string (SQLite file location)
DATABASE_URL="file:./dev.db"

# Secret token used by NextAuth / Auth.js for session management
AUTH_SECRET="some-random-32-character-secret-key-here"

# GitHub OAuth App credentials (optional: defaults to Guest Mode if empty)
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# SSRF Protections Bypass (Set to true ONLY in local dev environment)
ALLOW_LOCAL_SSRF="true"

# Local source directory path
LOCAL_WORKSPACE_PATH=""
```

---

## 📦 Getting Started

### 1. Install Dependencies
Run the following command at the project root to install all required dependencies:
```bash
npm install
```

### 2. Set Up the Local Database
Generate the Prisma client and push the initial database schema to SQLite:
```bash
npx prisma generate
npx prisma db push
```

### 3. Compile the Ghost Cursor Package
Build the workspace SDK library:
```bash
npm run build --workspace=packages/ghost-cursor
# Or compile directly in the sub-folder:
cd packages/ghost-cursor && npm run build
```

### 4. Run the Development Server
Launch the local Next.js development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the OCMS dashboard.

---

## 🏗️ Building and Deploying

To compile the production bundle:
```bash
npm run build
```

OCMS runs perfectly in serverless environments (like Vercel). However, because serverless platforms have read-only/ephemeral filesystems:
*   Local file writing and local build validation routes (`/api/publish-changes` and `/api/validate-build`) are automatically guarded and will return informative error/warning responses instead of crashing.
*   To enable direct code commits and deploys in cloud environments, link your workspaces to Git repositories via the OAuth panel.

---

## 👥 Authors

Built with precision and passion by **Team SPACHT**.
