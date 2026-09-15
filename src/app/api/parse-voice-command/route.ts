import { NextRequest, NextResponse } from "next/server";
import type { SchemaField } from "@/types/schema";

function parseVoiceCommandLocal(prompt: string, schema: SchemaField[]) {
    const text = prompt.toLowerCase();
    
    let newValue = "";
    
    // Check for quoted strings first (e.g. "Welcome Back" or 'Welcome Back')
    const quoteMatch = prompt.match(/(?:"([^"]*)"|'([^']*)'|“([^”]*)”|‘([^’]*)’)/);
    if (quoteMatch) {
        newValue = (quoteMatch[1] || quoteMatch[2] || quoteMatch[3] || quoteMatch[4] || "").trim();
    } else {
        // Find text value after trigger words: "to", "set", "change", "be", "with", "should read", "should be", "should say", "reads", "says", "read"
        const match = prompt.match(/\b(?:to|set|change|be|with|should\s+read|should\s+be|should\s+say|reads|says|read|write)\s+(.+)$/i);
        if (match) {
            newValue = match[1].trim();
            // Strip leading colons/punctuation or spaces
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

    let bestField = null;
    let maxScore = -1;

    for (const field of schema) {
        let score = 0;
        const id = (field.id || "").toLowerCase();
        const label = (field.label || "").toLowerCase();

        // Check matches in id/label
        if (text.includes(id)) score += 10;
        if (text.includes(label)) score += 8;

        // Semantic matches
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
        bestField = schema.find((f) => f.type === "text") || schema[0];
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
    try {
        const { prompt, schema } = await req.json();

        if (!prompt || typeof prompt !== "string" || !schema || !Array.isArray(schema)) {
            return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
        }

        const parsed = parseVoiceCommandLocal(prompt, schema);

        if (!parsed) {
            return NextResponse.json({ error: "Failed to parse voice command" }, { status: 422 });
        }

        return NextResponse.json(parsed);
    } catch (err) {
        console.error("Voice edit error:", err);
        return NextResponse.json({ error: "Failed to parse voice command" }, { status: 500 });
    }
}
