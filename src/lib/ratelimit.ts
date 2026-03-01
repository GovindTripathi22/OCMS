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
