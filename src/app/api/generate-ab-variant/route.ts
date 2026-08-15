import { NextRequest, NextResponse } from "next/server";
import { generateAbVariants } from "@/lib/gemini";

export async function POST(req: NextRequest) {
    try {
        const { schema, targetAudience } = await req.json();

        if (!schema || !targetAudience || !Array.isArray(schema)) {
            return NextResponse.json({ error: "schema and targetAudience are required" }, { status: 400 });
        }

        const newSchema = await generateAbVariants(schema, String(targetAudience));

        return NextResponse.json({ schema: newSchema });
    } catch (err) {
        console.error("A/B Variant generation error:", err);
        return NextResponse.json({ error: "Failed to generate variant" }, { status: 500 });
    }
}
