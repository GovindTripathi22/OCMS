import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth-guards";
import { withRateLimit } from "@/lib/ratelimit";
import { createErrorResponse, parseJsonSafely, LIMITS } from "@/lib/validation";
import type { SchemaField } from "@/types/schema";

function parseVoiceCommandLocal(prompt: string, schema: SchemaField[]) {
    const text = prompt.toLowerCase();
    let newValue = "";

    // Check for quoted strings first
    const quoteMatch = prompt.match(/(?:"([^"]*)"|'([^']*)'|“([^”]*)”|‘([^’]*)’)/);
    if (quoteMatch) {
        newValue = (quoteMatch[1] || quoteMatch[2] || quoteMatch[3] || quoteMatch[4] || "").trim();
    } else {
        const match = prompt.match(/\b(?:to|set|change|be|with|should\s+read|should\s+be|should\s+say|reads|says|read|write)\s+(.+)$/i);
        if (match) {
            newValue = match[1].trim();
            newValue = newValue.replace(/^[:\s\-—]+/, "").trim();
            newValue = newValue.replace(/^["'“”‘]|["'“”’]$/g, "").trim();
        } else {
            const words = prompt.trim().split(/\s+/);
            if (words.length > 2) {
                newValue = words.slice(-2).join(" ");
            }
        }
    }

    if (!newValue) return null;

    let bestField: SchemaField | null = null;
    let maxScore = -1;

    for (const field of schema) {
        let score = 0;
        const id = (field.id || "").toLowerCase();
        const label = (field.label || "").toLowerCase();

        if (text.includes(id)) score += 10;
        if (text.includes(label)) score += 8;

        if (id.includes("title") || label.includes("title") || id.includes("heading") || label.includes("heading")) {
            if (text.includes("title") || text.includes("heading") || text.includes("header")) score += 5;
        }
        if (id.includes("subtitle") || label.includes("subtitle") || id.includes("sub") || label.includes("sub")) {
            if (text.includes("subtitle") || text.includes("sub")) score += 5;
        }
        if (id.includes("button") || label.includes("button") || id.includes("cta") || label.includes("cta")) {
            if (text.includes("button") || text.includes("cta") || text.includes("action")) score += 5;
        }
        if (id.includes("image") || label.includes("image") || id.includes("photo") || label.includes("photo") || id.includes("pic") || label.includes("pic")) {
            if (text.includes("image") || text.includes("photo") || text.includes("picture") || text.includes("logo")) score += 5;
        }
        if (id.includes("link") || label.includes("link") || id.includes("url") || label.includes("url")) {
            if (text.includes("link") || text.includes("url") || text.includes("href")) score += 5;
        }

        if (score > maxScore) {
            maxScore = score;
            bestField = field;
        }
    }

    if (maxScore <= 0) {
        bestField = schema.find((f) => f.type === "text") || schema[0] || null;
    }

    if (bestField) {
        return {
            fieldId: bestField.id,
            newValue: newValue
        };
    }
    return null;
}

export async function POST(req: NextRequest) {
    const rateLimited = await withRateLimit("parse-voice-command", req, { limit: 30, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const authCheck = await requireAuthenticatedUser();
    if (authCheck.error) {
        return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
    }

    const { data, error: jsonError } = await parseJsonSafely<{ prompt?: string; schema?: SchemaField[] }>(
        req,
        LIMITS.SCHEMA_MAX_BYTES
    );
    if (jsonError) return jsonError;

    const prompt = data?.prompt?.trim();
    const schema = data?.schema;

    if (!prompt || !schema || !Array.isArray(schema)) {
        return createErrorResponse("INVALID_INPUT", "prompt (string) and schema (array) are required", 400);
    }

    if (prompt.length > 500) {
        return createErrorResponse("PROMPT_TOO_LONG", "Prompt cannot exceed 500 characters", 400);
    }

    if (schema.length > LIMITS.SCHEMA_MAX_FIELDS) {
        return createErrorResponse("SCHEMA_TOO_LARGE", `Schema exceeds maximum of ${LIMITS.SCHEMA_MAX_FIELDS} fields`, 400);
    }

    const parsed = parseVoiceCommandLocal(prompt, schema);

    if (!parsed) {
        return createErrorResponse("PARSE_FAILED", "Could not parse an editable field command from the prompt", 422);
    }

    return NextResponse.json({
        success: true,
        ...parsed,
    });
}
