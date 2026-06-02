import { NextRequest, NextResponse } from "next/server";
import { callGemini, safeJsonParse } from "@/lib/gemini";

/**
 * POST /api/extract-colors
 *
 * Uses AI to generate a 5-color palette based on a brand name or description.
 */
export async function POST(req: NextRequest) {
    try {
        const { brandDescription } = await req.json();

        if (!brandDescription) {
            return NextResponse.json({ error: "brandDescription is required" }, { status: 400 });
        }

        const systemPrompt = `You are an expert brand designer and color theorist.
YOUR TASK: Generate a cohesive 5-color palette based on the user's brand description.

RULES:
1. The palette must contain exactly 5 colors.
2. Output MUST be a valid JSON array of 5 hex color strings (e.g., ["#FFFFFF", "#000000", ...]).
3. Ensure the colors work well together for modern web design (e.g., background, primary, secondary, accent, text).
4. NO markdown formatting, NO explanations, just the JSON array.`;

        const prompt = `Generate a 5-color palette for this brand: ${brandDescription}`;

        const response = await callGemini(prompt, systemPrompt, true);
        const colors = safeJsonParse<string[]>(response);

        if (!Array.isArray(colors) || colors.length !== 5) {
            throw new Error("Invalid color array format returned by AI.");
        }

        return NextResponse.json({ colors });
    } catch (err) {
        console.error("Color extraction error:", err);
        return NextResponse.json({ error: "Failed to extract colors" }, { status: 500 });
    }
}
