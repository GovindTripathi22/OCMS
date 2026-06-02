/**
 * Gemini API utilities for OCMS.
 *
 * All AI interactions go through this module:
 * - Schema generation from scraped HTML (strict system prompt)
 * - A/B content generation
 * - Component replication
 * - Voice command parsing
 * - Color palette extraction
 * - PBR texture prompt generation
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{ text?: string }>;
        };
    }>;
}

import type { SchemaField } from "@/types/schema";


/**
 * Low-level call to Gemini API with system instruction support.
 * @param expectJson - when true, forces application/json MIME type for structured output.
 */
export async function callGemini(
    prompt: string,
    systemInstruction?: string,
    expectJson: boolean = false
): Promise<string> {
    if (!GEMINI_API_KEY) {
        throw new Error(
            "GEMINI_API_KEY is not set — add it to your .env.local file"
        );
    }

    const requestBody: Record<string, unknown> = {
        contents: [{ parts: [{ text: prompt }] }],
    };

    if (expectJson) {
        requestBody.generationConfig = {
            responseMimeType: "application/json",
        };
    }

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

/**
 * Safely parses a JSON response from Gemini, removing potential markdown code fences.
 */
export function safeJsonParse<T>(raw: string): T {
    const jsonMatch = raw.match(/```json\n?([\s\S]*?)\n?```/) || raw.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    const cleaned = jsonMatch ? jsonMatch[1] ?? jsonMatch[0] : raw;
    try {
        return JSON.parse(cleaned.trim()) as T;
    } catch (e) {
        throw new Error(`Failed to parse Gemini response as JSON: ${e instanceof Error ? e.message : String(e)}\nRaw response: ${raw.slice(0, 500)}`);
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _SCHEMA_SYSTEM_PROMPT = `You are an expert CMS schema architect for OCMS, an AI-powered headless CMS.

YOUR TASK: Analyze the provided HTML DOM structure and extract every editable text content field.

STRICT OUTPUT RULES:
1. Output ONLY a valid JSON array. No markdown, no explanation, no code fences.
2. Each object in the array MUST have exactly these fields:
   - "id": A unique, kebab-case identifier derived from the element's content or position (e.g., "hero-title", "nav-link-1", "footer-copyright")
   - "type": One of "text", "image", "link", or "list"
   - "value": The actual text content, image src, or href value
   - "originalHtmlTag": The HTML tag name in lowercase (e.g., "h1", "p", "a", "img")
   - "selector": A valid CSS selector string that document.querySelector can execute and that uniquely targets this exact element (e.g., "header > h1", "section.hero p.subtitle")

EXTRACTION RULES:
- Extract ALL visible text content: headings (h1-h6), paragraphs (p), links (a), list items (li), spans with meaningful text, buttons
- For images: extract the src as value, type as "image"
- For links: extract the href as value, type as "link", and include the link text in the id
- SKIP navigation boilerplate like "Home", "About", "Contact" unless they have unique content
- SKIP empty elements, whitespace-only elements, and icon fonts
- Generate unique IDs — if duplicates would occur, append a numeric suffix (e.g., "section-title-2")
- Prefer stable class/id/attribute selectors over positional selectors. Use :nth-of-type only when there is no stable attribute or class.
- Every selector MUST be syntactically valid for document.querySelector. Do not invent Tailwind variants, pseudo-elements, or text selectors.

RESPOND WITH ONLY THE JSON ARRAY.`;

const STRICT_SCHEMA_SYSTEM_PROMPT = `You are an expert CMS schema architect for OCMS, an AI-powered headless CMS.

YOUR TASK: Analyze the provided live HTML DOM structure and extract editable content fields that already exist in the markup.

STRICT OUTPUT RULES:
1. Output ONLY a valid JSON array. No markdown, no explanation, no code fences.
2. Each object in the array MUST have exactly these fields:
   - "id": A unique, kebab-case identifier derived from the element's content or position (e.g., "hero-title", "nav-link-1", "footer-copyright")
   - "type": One of "text", "image", "link", or "list"
   - "label": A short human-readable CMS label (e.g., "Hero Heading", "Pricing CTA Link", "Footer Copyright"). Never use generic labels like "text-1".
   - "value": The exact current text content, image src, or href value from the provided HTML. Do not summarize, rewrite, infer, or invent placeholder copy.
   - "originalHtmlTag": The HTML tag name in lowercase (e.g., "h1", "p", "a", "img")
   - "selector": A valid CSS selector string that document.querySelector can execute and that uniquely targets this exact element in the provided DOM.

EXTRACTION RULES:
- Extract actual currently visible content only: headings (h1-h6), paragraphs (p), meaningful spans, buttons, primary CTAs, list items, links, and visible images.
- For text fields, "value" must equal the element's visible textContent after whitespace normalization.
- For images, "value" must equal the src, data-src, poster, or CSS background image URL found on the matched element.
- For links, "value" must equal the href found on the matched <a> element, and the label/id should use the link's visible purpose.
- SKIP navigation boilerplate like "Home", "About", "Contact" unless they have unique content.
- SKIP empty elements, whitespace-only elements, and icon fonts.
- Generate unique IDs. If duplicates would occur, append a numeric suffix (e.g., "section-title-2").
- Prefer precise stable selectors in this order: unique id, unique aria/data attribute, unique class or Tailwind class combination, then a structured parent > child path using tag names and :nth-of-type.
- When using Tailwind classes with special characters, use a document.querySelector-safe selector form such as [class~="md:text-6xl"] instead of invalid unescaped dot syntax.
- The selector must resolve to exactly the element that owns the returned value. Do not target a parent container if a child node owns the text.
- Every selector MUST be syntactically valid for document.querySelector. Do not invent Tailwind variants, pseudo-elements, or text selectors.
- Never output demo or placeholder values such as "Welcome to our site", "Build something amazing today", "/placeholder.jpg", or guessed marketing copy unless that exact text appears in the HTML.

RESPOND WITH ONLY THE JSON ARRAY.`;

/**
 * Converts cleaned HTML into a structured JSON schema using Gemini.
 */
export async function generateSchema(
    html: string,
    sourceUrl?: string
): Promise<SchemaField[]> {
    const prompt = `Analyze this live HTML${sourceUrl ? ` from ${sourceUrl}` : ""} and extract editable content fields. Values and selectors will be validated against this exact HTML, so every value must come from the markup and every selector must match:

${html.slice(0, 15000)}`;

    const raw = await callGemini(prompt, STRICT_SCHEMA_SYSTEM_PROMPT, true);
    const parsed = safeJsonParse<SchemaField[]>(raw);
    if (!Array.isArray(parsed)) {
        throw new Error("Expected JSON array from Gemini schema generation");
    }
    return parsed;
}

/**
 * Generates a technical PBR texture prompt from a simple user description.
 */
export async function generateTexturePrompt(input: string): Promise<string> {
    const systemPrompt = `You are a material scientist and 3D artist specializing in PBR (Physically Based Rendering) textures.
    
    YOUR TASK: Convert a simple user description into a technical, highly detailed prompt for an AI image generator to create a seamless, tileable 3D texture map.
    
    REQUIREMENTS:
    - Describe the Albedo/Base Color: subtle variations, realistic colors.
    - Describe the Normal Map: depth, cracks, surface detail.
    - Describe the Roughness/Specular: how the light hits the material.
    - Mention keywords: "seamless", "tileable", "8k resolution", "PBR material", "photorealistic".
    - OUTPUT RULE: Respond ONLY with the prompt text. No titles, no labels, no quotes.`;

    const prompt = `Create a high-quality texture prompt for: ${input}`;
    return callGemini(prompt, systemPrompt);
}

/**
 * General-purpose content generation.
 */
export async function generateContent(prompt: string): Promise<string> {
    return callGemini(prompt);
}
