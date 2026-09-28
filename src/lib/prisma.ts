// Importing the standard PrismaClient (not the edge or adapter version)
// Fixes: PrismaClientConstructorValidationError: Using engine type "client" requires either "adapter" or "accelerateUrl"
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

// On Vercel serverless, the deployment filesystem is read-only.
// If using local SQLite, copy the pre-seeded SQLite database to /tmp so writes succeed.
if (process.env.VERCEL) {
    try {
        const currentUrl = process.env.DATABASE_URL || "file:./dev.db";
        if (currentUrl.startsWith("file:")) {
            const tmpDbPath = path.join("/tmp", "dev.db");
            if (!fs.existsSync(tmpDbPath)) {
                const candidates = [
                    path.join(process.cwd(), "prisma", "dev.db"),
                    path.join(process.cwd(), "dev.db"),
                ];
                for (const src of candidates) {
                    if (fs.existsSync(src)) {
                        fs.copyFileSync(src, tmpDbPath);
                        break;
                    }
                }
            }
            process.env.DATABASE_URL = `file:${tmpDbPath}`;
        }
    } catch (err) {
        console.warn("[Prisma] Vercel writable SQLite preparation notice:", err);
    }
}

if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "file:./prisma/dev.db";
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" DATETIME,
    "image" TEXT,
    "subscription" TEXT NOT NULL DEFAULT 'FREE',
    "generationsUsed" INTEGER NOT NULL DEFAULT 0,
    "generationsReset" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "githubRepoUrl" TEXT,
    "githubOwner" TEXT,
    "githubRepo" TEXT,
    "githubBranch" TEXT NOT NULL DEFAULT 'main',
    "targetFilePath" TEXT,
    "sourceUrl" TEXT,
    "generatedSchema" JSONB,
    "schemaRevision" INTEGER NOT NULL DEFAULT 0,
    "gsdState" JSONB,
    "gsdContext" JSONB,
    "gsdPlan" JSONB,
    "brandGuidelines" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Asset3D" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "urlHighPoly" TEXT,
    "urlMediumPoly" TEXT,
    "urlLowPoly" TEXT,
    "projectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asset3D_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "ModelVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "variantName" TEXT NOT NULL,
    "textureUrl" TEXT,
    "materialProperties" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ModelVariant_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset3D" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "SceneGraph" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sceneData" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS "WebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event" TEXT NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "_SceneGraphAssets" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_SceneGraphAssets_A_fkey" FOREIGN KEY ("A") REFERENCES "Asset3D" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_SceneGraphAssets_B_fkey" FOREIGN KEY ("B") REFERENCES "SceneGraph" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session"("sessionToken");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE INDEX IF NOT EXISTS "Project_userId_idx" ON "Project"("userId");
CREATE INDEX IF NOT EXISTS "Asset3D_projectId_idx" ON "Asset3D"("projectId");
CREATE INDEX IF NOT EXISTS "ModelVariant_assetId_idx" ON "ModelVariant"("assetId");
`;

let isDbInitialized = false;

export async function ensureDatabaseTables(): Promise<void> {
    if (isDbInitialized) return;
    try {
        const statements = SCHEMA_SQL.split(";")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        for (const sql of statements) {
            await prisma.$executeRawUnsafe(sql);
        }
        isDbInitialized = true;
    } catch (err) {
        console.warn("[Prisma] Table verification notice:", err);
    }
}
