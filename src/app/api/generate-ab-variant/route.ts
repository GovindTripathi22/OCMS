import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth-guards";
import { withRateLimit } from "@/lib/ratelimit";
import { createErrorResponse, parseJsonSafely, LIMITS } from "@/lib/validation";
import type { SchemaField } from "@/types/schema";

const SUPPORTED_TONES = new Set([
    "gen-z",
    "corporate",
    "casual",
    "luxury",
    "minimalist",
    "playful",
    "technical",
]);

function localAbRewrite(schema: SchemaField[], target: string): SchemaField[] {
    const tones: Record<string, {
        headline: string;
        subtitle: string;
        button: string;
        general: (val: string) => string;
    }> = {
        "gen-z": {
            headline: "The next-gen web platform is live and verified.",
            subtitle: "Direct local-first visual editing with zero lag. Free and open source.",
            button: "LAUNCH INSTANTLY",
            general: (val) => val
        },
        "corporate": {
            headline: "Optimize your enterprise digital value chain.",
            subtitle: "Achieve operational excellence and synergistic workflows with our headless platform.",
            button: "SCHEDULE DEMO",
            general: (val) => "Enterprise " + val
        },
        "casual": {
            headline: "Editing websites is simple and fast.",
            subtitle: "No complicated systems or headaches. Just click and edit whatever you want.",
            button: "Get Started",
            general: (val) => val
        },
        "luxury": {
            headline: "Exquisite digital experiences. Curated for you.",
            subtitle: "Indulge in premium content orchestration. Tailored craftsmanship meets performance.",
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
            headline: "Delightful content editing made effortless!",
            subtitle: "Click anything, swap in a 3D model, and see updates instantly.",
            button: "EXPLORE NOW",
            general: (val) => val
        },
        "technical": {
            headline: "A local-first, zero-dependency content runtime.",
            subtitle: "Zero API latency, AST-driven JSX code patching, and deterministic PBR model pipelines.",
            button: "INITIALIZE CLIENT",
            general: (val) => "Deterministic " + val.charAt(0).toLowerCase() + val.slice(1)
        }
    };

    const tone = tones[target] || tones["casual"];

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

export async function POST(req: NextRequest) {
    const rateLimited = await withRateLimit("generate-ab-variant", req, { limit: 20, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const authCheck = await requireAuthenticatedUser();
    if (authCheck.error) {
        return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
    }

    const { data, error: jsonError } = await parseJsonSafely<{ schema?: SchemaField[]; targetAudience?: string }>(
        req,
        LIMITS.SCHEMA_MAX_BYTES
    );
    if (jsonError) return jsonError;

    const schema = data?.schema;
    const targetAudience = data?.targetAudience?.trim().toLowerCase();

    if (!schema || !Array.isArray(schema) || !targetAudience) {
        return createErrorResponse("INVALID_INPUT", "schema (array) and targetAudience (string) are required", 400);
    }

    if (schema.length > LIMITS.SCHEMA_MAX_FIELDS) {
        return createErrorResponse("SCHEMA_TOO_LARGE", `Schema exceeds maximum of ${LIMITS.SCHEMA_MAX_FIELDS} fields`, 400);
    }

    if (!SUPPORTED_TONES.has(targetAudience)) {
        return createErrorResponse(
            "UNSUPPORTED_TONE",
            `targetAudience must be one of: ${Array.from(SUPPORTED_TONES).join(", ")}`,
            400
        );
    }

    const newSchema = localAbRewrite(schema, targetAudience);

    return NextResponse.json({
        success: true,
        schema: newSchema,
    });
}
