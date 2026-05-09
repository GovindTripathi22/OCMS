import { NextRequest, NextResponse } from "next/server";
import { callGemini } from "@/lib/gemini";

export async function POST(req: NextRequest) {
    try {
        const { prompt, schema } = await req.json();

        const systemPrompt = `You are a voice command parser for a CMS. 
        Analyze the user's intent and find the matching field from the schema.
        SCHEMA: ${JSON.stringify(schema)}
        
        Return ONLY a JSON object with:
        - fieldId: string (the id of the field to update)
        - newValue: string (the new value to set)
        
        If the user says "Make the title Hello", and there is a field "hero-title", return {"fieldId": "hero-title", "newValue": "Hello"}.
        Respond with ONLY the JSON.`;

        const response = await callGemini(prompt, systemPrompt, true);
        const parsed = JSON.parse(response);

        return NextResponse.json(parsed);
    } catch (err) {
        console.error("Voice edit error:", err);
        return NextResponse.json({ error: "Failed to parse voice command" }, { status: 500 });
    }
}
