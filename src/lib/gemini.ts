import type { SchemaField } from "@/types/schema";

/**
 * Clean Gemini API Helper for OCMS
 * Supports both Google Gemini 1.5 Flash (when GEMINI_API_KEY is configured)
 * and seamless, smart deterministic fallbacks (when running offline or without key).
 */

export async function callGeminiApi(prompt: string, systemPrompt?: string): Promise<string | null> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey || apiKey.trim() === "" || apiKey.includes("placeholder") || apiKey.includes("your_")) {
        return null;
    }

    try {
        const fullPrompt = systemPrompt ? `${systemPrompt}\n\nUser Request:\n${prompt}` : prompt;
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`;

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: fullPrompt }],
                    },
                ],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1024,
                },
            }),
            signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (!response.ok) {
            console.warn(`[Gemini API] Request failed with status ${response.status}`);
            return null;
        }

        const data = await response.json();
        const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return typeof candidate === "string" ? candidate.trim() : null;
    } catch (err) {
        console.warn("[Gemini API] Error calling Gemini endpoint, using local fallback:", err);
        return null;
    }
}

/**
 * Smart Text Rewriter / Summarizer / Tone Changer
 */
export async function rewriteText(
    text: string,
    action: "summarize" | "change-tone" | "expand" | "fix-grammar" | "shorten",
    targetTone: string = "casual"
): Promise<string> {
    const prompt = `Perform the action "${action}" on the following text with target tone "${targetTone}":
"""
${text}
"""
Respond ONLY with the rewritten text. Do not include markdown code fences, quotes, or conversational explanations.`;

    const aiResult = await callGeminiApi(prompt, "You are a professional web copywriter and UX editor.");
    if (aiResult) {
        return aiResult.replace(/^["']|["']$/g, "").trim();
    }

    // Local Deterministic Fallback
    if (action === "summarize" || action === "shorten") {
        const trimmed = text.trim();
        if (trimmed.length <= 60) return trimmed;
        const sentences = trimmed.split(/(?<=[.!?])\s+/);
        if (sentences.length > 1 && sentences[0].length >= 20) {
            return sentences[0];
        }
        const words = trimmed.split(/\s+/);
        if (words.length > 12) {
            return words.slice(0, 12).join(" ") + "...";
        }
        return trimmed;
    }

    if (action === "expand") {
        return `${text} Built with modern performance, seamless UX, and complete reliability for your web application.`;
    }

    if (action === "fix-grammar") {
        return text.charAt(0).toUpperCase() + text.slice(1).trim();
    }

    // Tone Changer Fallback
    const replacements: Record<string, string> = {
        "you can": "you are empowered to",
        "we provide": "we deliver",
        "we have": "we offer",
        "want to": "aim to",
        "need to": "aspire to",
        "build": "craft",
        "make": "forge",
        "easy": "seamless",
        "fast": "blazing-fast",
        "simple": "intuitive",
        "help": "streamline",
        "use": "leverage",
        "start": "launch",
        "good": "exceptional",
        "better": "optimum",
        "change": "transform",
        "website": "platform",
    };

    let modified = text;
    for (const [word, replacement] of Object.entries(replacements)) {
        const regex = new RegExp(`\\b${word}\\b`, "gi");
        modified = modified.replace(regex, (match) => {
            if (match[0] === match[0].toUpperCase()) {
                return replacement.charAt(0).toUpperCase() + replacement.slice(1);
            }
            return replacement;
        });
    }
    return modified;
}

/**
 * Natural Language / Voice Command Parser
 */
export async function parseVoiceCommand(
    prompt: string,
    schema: SchemaField[]
): Promise<{ fieldId: string; newValue: string } | null> {
    const fieldsSummary = schema
        .map((f) => `Field ID: "${f.id}", Label: "${f.label}", Current Value: "${f.value}"`)
        .join("\n");

    const aiPrompt = `You are a voice and natural language editor assistant for a website CMS.
Given the user command and the list of editable fields, determine which field the user wants to modify and what the new value should be.

Available Fields:
${fieldsSummary}

User Command:
"${prompt}"

Return ONLY a valid JSON object in this exact format:
{"fieldId": "target_field_id", "newValue": "the new text or value"}
Do not include any explanation or extra characters.`;

    const aiResult = await callGeminiApi(aiPrompt);
    if (aiResult) {
        try {
            const cleanJson = aiResult.replace(/```json|```/g, "").trim();
            const parsed = JSON.parse(cleanJson);
            if (parsed && typeof parsed.fieldId === "string" && typeof parsed.newValue === "string") {
                const matchedField = schema.find((f) => f.id === parsed.fieldId);
                if (matchedField) {
                    return { fieldId: matchedField.id, newValue: parsed.newValue };
                }
            }
        } catch {
            // Fall through to deterministic parser
        }
    }

    // Local Regex Fallback
    const text = prompt.toLowerCase();
    let newValue = "";

    const quoteMatch = prompt.match(/(?:"([^"]*)"|'([^']*)'|“([^”]*)”|‘([^’]*)’)/);
    if (quoteMatch) {
        newValue = (quoteMatch[1] || quoteMatch[2] || quoteMatch[3] || quoteMatch[4] || "").trim();
    } else {
        const match = prompt.match(/\b(?:to|set|change|be|with|should\s+read|should\s+be|should\s+say|reads|says|read|write)\s+(.+)$/i);
        if (match) {
            newValue = match[1].replace(/^[:\s\-—]+/, "").replace(/^["'“”‘]|["'“”’]$/g, "").trim();
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
        if (id.includes("title") || label.includes("title") || id.includes("heading")) {
            if (text.includes("title") || text.includes("heading")) score += 5;
        }
        if (id.includes("button") || label.includes("button") || id.includes("cta")) {
            if (text.includes("button") || text.includes("cta")) score += 5;
        }
        if (score > maxScore) {
            maxScore = score;
            bestField = field;
        }
    }

    if (!bestField || maxScore <= 0) {
        bestField = schema.find((f) => f.type === "text") || schema[0] || null;
    }

    return bestField ? { fieldId: bestField.id, newValue } : null;
}

/**
 * A/B Variant Generator with Gemini AI & Deterministic Fallback
 */
export async function generateAbVariants(
    schema: SchemaField[],
    targetAudience: string
): Promise<SchemaField[]> {
    const textFields = schema.filter((f) => f.type === "text" || f.type === "link");
    if (textFields.length === 0) return schema;

    const fieldsSummary = textFields.map((f) => ({ id: f.id, label: f.label, value: f.value }));

    const aiPrompt = `You are an expert conversion-rate optimization (CRO) and marketing copywriter.
Rewrite the following website text elements to target a "${targetAudience}" audience.
Keep the core value proposition intact while adjusting tone, vocabulary, and call-to-action phrasing.

Current fields:
${JSON.stringify(fieldsSummary, null, 2)}

Respond ONLY with a JSON array of objects with the exact format:
[
  { "id": "field_id", "value": "rewritten copy" }
]
Do not include any explanation or markdown code block fences.`;

    const aiResult = await callGeminiApi(aiPrompt);
    if (aiResult) {
        try {
            const cleanJson = aiResult.replace(/```json|```/g, "").trim();
            const parsed = JSON.parse(cleanJson);
            if (Array.isArray(parsed)) {
                const map = new Map<string, string>();
                for (const item of parsed) {
                    if (item && typeof item.id === "string" && typeof item.value === "string") {
                        map.set(item.id, item.value);
                    }
                }
                return schema.map((field) => {
                    if (map.has(field.id)) {
                        return { ...field, value: map.get(field.id)! };
                    }
                    return field;
                });
            }
        } catch {
            // Fall through to deterministic fallback
        }
    }

    // Local Tone Mapping Fallback
    const tones: Record<string, {
        headline: string;
        subtitle: string;
        button: string;
        general: (val: string) => string;
    }> = {
        "gen-z": {
            headline: "No cap, the next-gen web platform is here. It's bussin'.",
            subtitle: "Main character energy for your content. Edit directly in the page without boomer lag. 100% free.",
            button: "LAUNCH INSTANTLY 🚀",
            general: (val) => val + " (fr fr, no cap)"
        },
        "corporate": {
            headline: "Optimize your enterprise digital value chain.",
            subtitle: "Achieve operational excellence and synergistic workflows with our industry-leading headless experience platform.",
            button: "SCHEDULE DEMO",
            general: (val) => "Leveraging " + val
        },
        "casual": {
            headline: "Hey there! We make editing websites super easy.",
            subtitle: "No complicated systems, no headaches. Just click and edit whatever you want, right in place.",
            button: "Let's Get Started!",
            general: (val) => val + " - simple as that!"
        },
        "luxury": {
            headline: "Exquisite digital experiences. Curated for you.",
            subtitle: "Indulge in premium content orchestration. Tailored craftsmanship meets ultimate performance.",
            button: "ENTER EXPERIENCE",
            general: (val) => "Bespoke " + val
        },
        "minimalist": {
            headline: "Less, but better.",
            subtitle: "Content. Streamlined. Local-first headless CMS.",
            button: "ENTER",
            general: (val) => val
        },
        "playful": {
            headline: "A site so fine, you'll want to edit all the time! 🥳",
            subtitle: "Wrangling content doesn't have to be a drag. Click anything, swap in a cool 3D model, and let's play!",
            button: "GIVE IT A SPIN! ✨",
            general: (val) => val + " 🎉"
        },
        "technical": {
            headline: "A local-first, zero-dependency content runtime.",
            subtitle: "Zero API latency, AST-driven JSX code patching, and custom PBR model variant pipeline.",
            button: "INITIALIZE CLIENT",
            general: (val) => "Compile-time " + val.charAt(0).toLowerCase() + val.slice(1)
        }
    };

    const tone = tones[targetAudience] || tones["casual"];

    return schema.map((field) => {
        if (field.type !== "text" && field.type !== "link") return field;
        if (!field.value || field.value.trim().length < 5) return field;

        let newValue = field.value;
        const id = (field.id || "").toLowerCase();

        if (id.includes("title") || id.includes("headline") || id.includes("main")) {
            newValue = tone.headline;
        } else if (id.includes("subtitle") || id.includes("description") || id.includes("desc") || id.includes("para")) {
            newValue = tone.subtitle;
        } else if (id.includes("button") || id.includes("cta") || id.includes("action") || id.includes("get-started")) {
            newValue = tone.button;
        } else {
            newValue = tone.general(field.value);
        }

        return { ...field, value: newValue };
    });
}
