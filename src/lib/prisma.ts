// Importing the standard PrismaClient (not the edge or adapter version)
// Fixes: PrismaClientConstructorValidationError: Using engine type "client" requires either "adapter" or "accelerateUrl"
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: ["query"],
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
