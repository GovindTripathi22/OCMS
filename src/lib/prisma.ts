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
            if (fs.existsSync(tmpDbPath)) {
                process.env.DATABASE_URL = `file:${tmpDbPath}`;
            }
        }
    } catch (err) {
        console.warn("[Prisma] Vercel writable SQLite preparation notice:", err);
    }
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
