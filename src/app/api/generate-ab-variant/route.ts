import { NextRequest } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth-guards";
import { withRateLimit } from "@/lib/ratelimit";
import { createErrorResponse, parseJsonSafely, LIMITS } from "@/lib/validation";
import type { SchemaField } from "@/types/schema";

const SUPPORTED_TONES = new Set([
    "gen-z",
    "corporate",
    "casual",
    "luxury",
    "minimalist",
    "playful",
    "technical",
]);

export async function POST(req: NextRequest) {
    const rateLimited = await withRateLimit("generate-ab-variant", req, { limit: 20, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const authCheck = await requireAuthenticatedUser();
    if (authCheck.error) {
        return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
    }

    const { data, error: jsonError } = await parseJsonSafely<{ schema?: SchemaField[]; targetAudience?: string }>(
        req,
        LIMITS.SCHEMA_MAX_BYTES
    );
    if (jsonError) return jsonError;

    const schema = data?.schema;
    const targetAudience = data?.targetAudience?.trim().toLowerCase();

    if (!schema || !Array.isArray(schema) || !targetAudience) {
        return createErrorResponse("INVALID_INPUT", "schema (array) and targetAudience (string) are required", 400);
    }

    if (schema.length > LIMITS.SCHEMA_MAX_FIELDS) {
        return createErrorResponse("SCHEMA_TOO_LARGE", `Schema exceeds maximum of ${LIMITS.SCHEMA_MAX_FIELDS} fields`, 400);
    }

    if (!SUPPORTED_TONES.has(targetAudience)) {
        return createErrorResponse(
            "UNSUPPORTED_TONE",
            `targetAudience must be one of: ${Array.from(SUPPORTED_TONES).join(", ")}`,
            400
        );
    }

    return createErrorResponse(
        "NOT_IMPLEMENTED",
        "A/B variant generation requires generative AI capabilities and is disabled in AI-free mode.",
        501
    );
}
