import { NextRequest, NextResponse } from "next/server";
import { callGemini, safeJsonParse } from "@/lib/gemini";
import type { SchemaField } from "@/types/schema";



/**
 * POST /api/generate-ab-variant
 *
 * Takes the current schema and an audience target (e.g., 'gen-z')
 * and returns a modified schema with new copy.
 */
export async function POST(req: NextRequest) {
    try {
        const { schema, targetAudience } = await req.json();

        if (!schema || !targetAudience) {
            return NextResponse.json({ error: "schema and targetAudience are required" }, { status: 400 });
        }

        const systemPrompt = `You are an expert copywriter and A/B testing specialist.
YOUR TASK: Rewrite the text fields in the provided schema to appeal specifically to the target audience: "${targetAudience}".

RULES:
1. ONLY modify fields of type "text" or "link" (the link text). Do NOT modify images or 3D models.
2. Keep the exact same JSON structure, IDs, types, originalHtmlTag, and selectors.
3. Change ONLY the "value" property of the text/link fields to match the tone of the target audience.
4. Output MUST be valid JSON (an array of schema objects), matching the input structure exactly.
5. NO markdown formatting, NO explanations, just the JSON array.`;

        const prompt = `Rewrite this schema for audience: ${targetAudience}\n\n${JSON.stringify(schema, null, 2)}`;

        const response = await callGemini(prompt, systemPrompt, true);
        const newSchema = safeJsonParse<SchemaField[]>(response);

        return NextResponse.json({ schema: newSchema });
    } catch (err) {
        console.error("A/B Variant generation error:", err);
        return NextResponse.json({ error: "Failed to generate variant" }, { status: 500 });
    }
}
