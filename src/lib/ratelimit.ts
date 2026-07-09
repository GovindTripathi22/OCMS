/**
 * Runtime route limiter and DB-backed user quota helpers for OCMS.
 */

import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const LIMITS: Record<string, number> = {
    FREE: 10,
    PRO: 100,
};

const CYCLE_MS = 30 * 24 * 60 * 60 * 1000;

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    limit: number;
    resetsAt: Date;
}

interface RuntimeRateLimitOptions {
    limit?: number;
    windowMs?: number;
}

interface RuntimeBucket {
    count: number;
    resetAt: number;
}

const DEFAULT_RUNTIME_LIMIT = 60;
const DEFAULT_RUNTIME_WINDOW_MS = 60_000;

const runtimeBucketStore = globalThis as typeof globalThis & {
    __ocmsRuntimeRateLimitBuckets?: Map<string, RuntimeBucket>;
};

const runtimeBuckets: Map<string, RuntimeBucket> =
    runtimeBucketStore.__ocmsRuntimeRateLimitBuckets ?? new Map<string, RuntimeBucket>();
runtimeBucketStore.__ocmsRuntimeRateLimitBuckets = runtimeBuckets;

export async function withRateLimit(
    scope: string,
    req: Request,
    options: RuntimeRateLimitOptions = {}
): Promise<NextResponse | null> {
    const limit = options.limit ?? DEFAULT_RUNTIME_LIMIT;
    const windowMs = options.windowMs ?? DEFAULT_RUNTIME_WINDOW_MS;
    const now = Date.now();

    for (const identity of requestRateLimitIdentities(req)) {
        const key = `${scope}:${identity}`;
        const bucket = runtimeBuckets.get(key);

        if (!bucket || bucket.resetAt <= now) {
            runtimeBuckets.set(key, { count: 1, resetAt: now + windowMs });
            continue;
        }

        if (bucket.count >= limit) {
            const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
            return NextResponse.json(
                { error: "Rate limit exceeded", retryAfter: retryAfterSeconds },
                { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
            );
        }

        bucket.count += 1;
    }

    pruneRuntimeBuckets(now);
    return null;
}

function requestRateLimitIdentities(req: Request): string[] {
    const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const realIp = req.headers.get("x-real-ip")?.trim();
    const identities = [`ip:${forwardedFor || realIp || "unknown"}`];
    const sessionToken = readSessionToken(req.headers.get("cookie") || "");

    if (sessionToken) {
        identities.push(`session:${hashIdentity(sessionToken)}`);
    }

    return identities;
}

function readSessionToken(cookieHeader: string): string | null {
    const sessionCookie = cookieHeader
        .split(";")
        .map((part) => part.trim())
        .find((cookie) => {
            const name = cookie.split("=")[0];
            return name === "authjs.session-token" ||
                name === "__Secure-authjs.session-token" ||
                name === "next-auth.session-token" ||
                name === "__Secure-next-auth.session-token";
        });

    return sessionCookie ? sessionCookie.slice(sessionCookie.indexOf("=") + 1) : null;
}

function hashIdentity(value: string): string {
    return crypto.createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function pruneRuntimeBuckets(now: number): void {
    if (runtimeBuckets.size < 1000) return;
    runtimeBuckets.forEach((bucket, key) => {
        if (bucket.resetAt <= now) runtimeBuckets.delete(key);
    });
}

export async function checkAndIncrementQuota(
    userId: string,
    subscription: string
): Promise<RateLimitResult> {
    const limit = LIMITS[subscription] ?? LIMITS.FREE;

    for (let attempt = 0; attempt < 3; attempt++) {
        const now = new Date();
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { generationsUsed: true, generationsReset: true },
        });

        if (!user) {
            return { allowed: false, remaining: 0, limit, resetsAt: now };
        }

        const cycleExpired = now.getTime() - user.generationsReset.getTime() > CYCLE_MS;
        if (cycleExpired) {
            const reset = await prisma.user.updateMany({
                where: { id: userId, generationsReset: user.generationsReset },
                data: { generationsUsed: 0, generationsReset: now },
            });

            if (reset.count > 0) continue;
        }

        const increment = await prisma.user.updateMany({
            where: { id: userId, generationsUsed: { lt: limit } },
            data: { generationsUsed: { increment: 1 } },
        });

        if (increment.count > 0) {
            const updated = await prisma.user.findUnique({
                where: { id: userId },
                select: { generationsUsed: true, generationsReset: true },
            });
            const used = updated?.generationsUsed ?? limit;
            const resetBase = updated?.generationsReset ?? user.generationsReset;

            return {
                allowed: true,
                remaining: Math.max(0, limit - used),
                limit,
                resetsAt: new Date(resetBase.getTime() + CYCLE_MS),
            };
        }

        const latest = await prisma.user.findUnique({
            where: { id: userId },
            select: { generationsUsed: true, generationsReset: true },
        });

        if (!latest || latest.generationsUsed >= limit) {
            return {
                allowed: false,
                remaining: 0,
                limit,
                resetsAt: new Date((latest?.generationsReset ?? user.generationsReset).getTime() + CYCLE_MS),
            };
        }
    }

    const now = new Date();
    return { allowed: false, remaining: 0, limit, resetsAt: new Date(now.getTime() + CYCLE_MS) };
}
