import { NextRequest, NextResponse } from "next/server";
import { callGemini } from "@/lib/gemini";

export async function POST(req: NextRequest) {
    try {
        const { prompt, schema } = await req.json();

        const systemPrompt = `You are a voice command parser for a CMS.
        Analyze the user's intent and find the single best matching field from the schema.
        SCHEMA: ${JSON.stringify(schema)}
        
        Return ONLY a JSON object with:
        - fieldId: string (MUST exactly match one id from the schema)
        - newValue: string (the new value to set)

        Match by id, label, selector, originalHtmlTag, and current value. Never invent field IDs.
        
        If the user says "Make the title Hello", and there is a field "hero-title", return {"fieldId": "hero-title", "newValue": "Hello"}.
        Respond with ONLY the JSON.`;

        const response = await callGemini(prompt, systemPrompt, true);
        const parsed = JSON.parse(response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());

        if (!schema?.some((field: { id: string }) => field.id === parsed.fieldId)) {
            return NextResponse.json({ error: "No matching schema field found" }, { status: 422 });
        }

        return NextResponse.json(parsed);
    } catch (err) {
        console.error("Voice edit error:", err);
        return NextResponse.json({ error: "Failed to parse voice command" }, { status: 500 });
    }
}
