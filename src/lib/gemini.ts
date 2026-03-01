/**
 * Gemini API utilities for OCMS.
 *
 * All AI interactions go through this module:
 * - Schema generation from scraped HTML (strict system prompt)
 * - General content generation (future)
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{ text?: string }>;
        };
    }>;
}

export interface SchemaField {
    id: string;
    type: "string" | "image" | "link" | "list";
    value: string;
    originalHtmlTag: string;
    selector: string;
}

/**
 * Low-level call to Gemini API with system instruction support.
 */
async function callGemini(
    prompt: string,
    systemInstruction?: string
): Promise<string> {
    if (!GEMINI_API_KEY) {
        throw new Error(
            "GEMINI_API_KEY is not set — add it to your .env.local file"
        );
    }

    const requestBody: Record<string, unknown> = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
        },
    };

    if (systemInstruction) {
        requestBody.systemInstruction = {
            parts: [{ text: systemInstruction }],
        };
    }

    const res = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API returned ${res.status}: ${errText}`);
    }

    const data: GeminiResponse = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error("Empty response from Gemini");
    }

    return text;
}

/** Strict system prompt for schema generation */
const SCHEMA_SYSTEM_PROMPT = `You are an expert CMS schema architect for OCMS, an AI-powered headless CMS.

YOUR TASK: Analyze the provided HTML DOM structure and extract every editable text content field.

STRICT OUTPUT RULES:
1. Output ONLY a valid JSON array. No markdown, no explanation, no code fences.
2. Each object in the array MUST have exactly these fields:
   - "id": A unique, kebab-case identifier derived from the element's content or position (e.g., "hero-title", "nav-link-1", "footer-copyright")
   - "type": One of "string", "image", "link", or "list"
   - "value": The actual text content, image src, or href value
   - "originalHtmlTag": The HTML tag name in lowercase (e.g., "h1", "p", "a", "img")
   - "selector": A CSS selector path that can uniquely target this element (e.g., "header > h1", "section.hero p.subtitle")

EXTRACTION RULES:
- Extract ALL visible text content: headings (h1-h6), paragraphs (p), links (a), list items (li), spans with meaningful text, buttons
- For images: extract the src as value, type as "image"
- For links: extract the href as value, type as "link", and include the link text in the id
- SKIP navigation boilerplate like "Home", "About", "Contact" unless they have unique content
- SKIP empty elements, whitespace-only elements, and icon fonts
- Generate unique IDs — if duplicates would occur, append a numeric suffix (e.g., "section-title-2")

RESPOND WITH ONLY THE JSON ARRAY.`;

/**
 * Converts cleaned HTML into a structured JSON schema using Gemini.
 */
export async function generateSchema(
    html: string,
    sourceUrl?: string
): Promise<SchemaField[]> {
    const prompt = `Analyze this HTML${sourceUrl ? ` from ${sourceUrl}` : ""} and extract all editable content fields:

${html.slice(0, 15000)}`;

    const raw = await callGemini(prompt, SCHEMA_SYSTEM_PROMPT);

    // Strip potential markdown code fences (safety fallback)
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    try {
        const parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed)) {
            throw new Error("Expected JSON array");
        }
        return parsed as SchemaField[];
    } catch {
        throw new Error(`Failed to parse Gemini response as JSON array: ${cleaned.slice(0, 200)}`);
    }
}

/**
 * General-purpose content generation.
 */
export async function generateContent(prompt: string): Promise<string> {
    return callGemini(prompt);
}
