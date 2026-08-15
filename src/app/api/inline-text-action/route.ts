import { NextRequest, NextResponse } from "next/server";
import { rewriteText } from "@/lib/gemini";

export async function POST(req: NextRequest) {
    try {
        const { action, value, tone } = await req.json();

        if (typeof value !== "string") {
            return NextResponse.json({ error: "Invalid text value" }, { status: 400 });
        }

        const validActions = ["summarize", "change-tone", "expand", "fix-grammar", "shorten"] as const;
        const selectedAction = validActions.includes(action) ? action : "change-tone";

        const result = await rewriteText(value, selectedAction, typeof tone === "string" ? tone : "casual");

        return NextResponse.json({ value: result.trim() });
    } catch (err) {
        console.error("Inline action error:", err);
        return NextResponse.json({ error: "Failed to run inline action" }, { status: 500 });
    }
}
