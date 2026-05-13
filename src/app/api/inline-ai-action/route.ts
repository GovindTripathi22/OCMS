import { NextRequest, NextResponse } from "next/server";
import { callGemini } from "@/lib/gemini";

const ACTION_PROMPTS: Record<string, string> = {
    summarize: "Summarize the text while preserving the original meaning and keeping it suitable for the same page location.",
    "change-tone": "Rewrite the text in a clearer, more polished marketing tone while preserving the original meaning.",
};

export async function POST(req: NextRequest) {
    try {
        const { action, value } = await req.json();

        if (!ACTION_PROMPTS[action] || typeof value !== "string") {
            return NextResponse.json({ error: "Invalid inline action" }, { status: 400 });
        }

        const systemPrompt = `You are an inline CMS editor.
Return ONLY the rewritten field value as plain text.
Do not add quotes, markdown, explanations, or labels.`;

        const prompt = `${ACTION_PROMPTS[action]}\n\nText:\n${value}`;
        const result = await callGemini(prompt, systemPrompt);

        return NextResponse.json({ value: result.trim() });
    } catch (err) {
        console.error("Inline AI action error:", err);
        return NextResponse.json({ error: "Failed to run inline action" }, { status: 500 });
    }
}
