import { NextRequest, NextResponse } from "next/server";
import { parseVoiceCommand } from "@/lib/gemini";

export async function POST(req: NextRequest) {
    try {
        const { prompt, schema } = await req.json();

        if (!prompt || typeof prompt !== "string" || !schema || !Array.isArray(schema)) {
            return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
        }

        const parsed = await parseVoiceCommand(prompt, schema);

        if (!parsed) {
            return NextResponse.json({ error: "Could not identify which field to change from that command." }, { status: 422 });
        }

        return NextResponse.json(parsed);
    } catch (err) {
        console.error("Voice edit error:", err);
        return NextResponse.json({ error: "Failed to parse voice command" }, { status: 500 });
    }
}
