import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth-guards";
import { withRateLimit } from "@/lib/ratelimit";
import { createErrorResponse, parseJsonSafely } from "@/lib/validation";

function hasWord(text: string, words: string[]): boolean {
    const pattern = new RegExp(`\\b(${words.join("|")})\\b`, "i");
    return pattern.test(text);
}

function generateProceduralSvgTexture(prompt: string): string {
    const p = prompt.toLowerCase();
    let svg = "";

    if (hasWord(p, ["wood", "pine", "timber"])) {
        svg = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
            <rect width="256" height="256" fill="#8B5A2B"/>
            <path d="M 0 40 Q 64 20 128 40 T 256 40 M 0 100 Q 80 120 160 100 T 256 100 M 0 180 Q 50 160 128 180 T 256 180" stroke="#5C3A21" stroke-width="4" fill="none" opacity="0.6"/>
            <path d="M 0 70 Q 120 90 200 70 T 256 70 M 0 140 Q 60 120 140 140 T 256 140 M 0 220 Q 90 240 180 220 T 256 220" stroke="#3D2314" stroke-width="2" fill="none" opacity="0.4"/>
        </svg>`;
    } else if (hasWord(p, ["chrome", "silver", "mirror"])) {
        svg = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="cr" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#e2e8f0"/>
                    <stop offset="30%" stop-color="#94a3b8"/>
                    <stop offset="50%" stop-color="#f8fafc"/>
                    <stop offset="70%" stop-color="#64748b"/>
                    <stop offset="100%" stop-color="#cbd5e1"/>
                </linearGradient>
            </defs>
            <rect width="256" height="256" fill="url(#cr)"/>
            <line x1="0" y1="0" x2="256" y2="256" stroke="#ffffff" stroke-width="1.5" opacity="0.4"/>
        </svg>`;
    } else if (hasWord(p, ["gold", "brass", "bronze"])) {
        svg = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="gd" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#fef08a"/>
                    <stop offset="50%" stop-color="#eab308"/>
                    <stop offset="100%" stop-color="#ca8a04"/>
                </linearGradient>
            </defs>
            <rect width="256" height="256" fill="url(#gd)"/>
            <circle cx="128" cy="128" r="80" fill="none" stroke="#fef9c3" stroke-width="2" opacity="0.3"/>
        </svg>`;
    } else if (hasWord(p, ["carbon", "fiber"])) {
        svg = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
            <rect width="256" height="256" fill="#111827"/>
            <defs>
                <pattern id="cf" width="16" height="16" patternUnits="userSpaceOnUse">
                    <rect width="8" height="8" fill="#1f2937"/>
                    <rect x="8" y="8" width="8" height="8" fill="#1f2937"/>
                    <line x1="0" y1="0" x2="16" y2="16" stroke="#374151" stroke-width="1" opacity="0.4"/>
                </pattern>
            </defs>
            <rect width="256" height="256" fill="url(#cf)"/>
        </svg>`;
    } else if (hasWord(p, ["metal", "steel", "iron"])) {
        svg = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#718096"/>
                    <stop offset="50%" stop-color="#cbd5e0"/>
                    <stop offset="100%" stop-color="#4a5568"/>
                </linearGradient>
            </defs>
            <rect width="256" height="256" fill="url(#g)"/>
            <line x1="0" y1="20" x2="256" y2="20" stroke="#fff" stroke-width="1" opacity="0.15"/>
            <line x1="0" y1="65" x2="256" y2="65" stroke="#000" stroke-width="1.5" opacity="0.2"/>
            <line x1="0" y1="120" x2="256" y2="120" stroke="#fff" stroke-width="1" opacity="0.15"/>
            <line x1="0" y1="185" x2="256" y2="185" stroke="#000" stroke-width="1.5" opacity="0.2"/>
            <line x1="0" y1="230" x2="256" y2="230" stroke="#fff" stroke-width="1" opacity="0.15"/>
        </svg>`;
    } else if (hasWord(p, ["rust", "corrode", "corrosion"])) {
        svg = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
            <rect width="256" height="256" fill="#4A3B32"/>
            <circle cx="40" cy="50" r="25" fill="#B85A1C" opacity="0.7"/>
            <circle cx="180" cy="190" r="45" fill="#8B4513" opacity="0.6"/>
            <circle cx="210" cy="70" r="15" fill="#A0522D" opacity="0.8"/>
            <circle cx="90" cy="140" r="30" fill="#CD853F" opacity="0.5"/>
            <path d="M 0 0 L 256 256" stroke="#5C2E0B" stroke-width="8" opacity="0.3" stroke-dasharray="10, 15"/>
            <path d="M 256 0 L 0 256" stroke="#5C2E0B" stroke-width="6" opacity="0.3" stroke-dasharray="5, 20"/>
        </svg>`;
    } else if (hasWord(p, ["leather", "skin"])) {
        svg = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
            <rect width="256" height="256" fill="#3D2314"/>
            <g opacity="0.15" stroke="#fff" stroke-width="0.5">
                <circle cx="10" cy="10" r="2" fill="none"/>
                <circle cx="50" cy="30" r="1.5" fill="none"/>
                <circle cx="90" cy="20" r="2.5" fill="none"/>
                <circle cx="140" cy="40" r="1.8" fill="none"/>
                <circle cx="190" cy="15" r="2" fill="none"/>
                <circle cx="230" cy="35" r="1.2" fill="none"/>
                <circle cx="30" cy="80" r="2" fill="none"/>
                <circle cx="70" cy="110" r="1.5" fill="none"/>
                <circle cx="110" cy="90" r="2.5" fill="none"/>
                <circle cx="160" cy="120" r="1.8" fill="none"/>
                <circle cx="20" cy="160" r="2" fill="none"/>
                <circle cx="60" cy="190" r="1.5" fill="none"/>
                <circle cx="100" cy="170" r="2.5" fill="none"/>
            </g>
        </svg>`;
    } else if (hasWord(p, ["brick", "wall"])) {
        svg = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
            <rect width="256" height="256" fill="#A52A2A"/>
            <line x1="0" y1="64" x2="256" y2="64" stroke="#e2e8f0" stroke-width="4"/>
            <line x1="0" y1="128" x2="256" y2="128" stroke="#e2e8f0" stroke-width="4"/>
            <line x1="0" y1="192" x2="256" y2="192" stroke="#e2e8f0" stroke-width="4"/>
            <line x1="64" y1="0" x2="64" y2="64" stroke="#e2e8f0" stroke-width="4"/>
            <line x1="192" y1="0" x2="192" y2="64" stroke="#e2e8f0" stroke-width="4"/>
            <line x1="128" y1="64" x2="128" y2="128" stroke="#e2e8f0" stroke-width="4"/>
            <line x1="0" y1="64" x2="0" y2="128" stroke="#e2e8f0" stroke-width="4"/>
            <line x1="64" y1="128" x2="64" y2="192" stroke="#e2e8f0" stroke-width="4"/>
            <line x1="192" y1="128" x2="192" y2="192" stroke="#e2e8f0" stroke-width="4"/>
            <line x1="128" y1="192" x2="128" y2="256" stroke="#e2e8f0" stroke-width="4"/>
        </svg>`;
    } else if (hasWord(p, ["checker", "chess", "grid"])) {
        svg = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
            <rect width="256" height="256" fill="#fff"/>
            <rect x="0" y="0" width="128" height="128" fill="#000"/>
            <rect x="128" y="128" width="128" height="128" fill="#000"/>
        </svg>`;
    } else {
        svg = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="d" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#4f46e5"/>
                    <stop offset="50%" stop-color="#ec4899"/>
                    <stop offset="100%" stop-color="#f59e0b"/>
                </linearGradient>
            </defs>
            <rect width="256" height="256" fill="url(#d)"/>
            <circle cx="128" cy="128" r="60" fill="none" stroke="#fff" stroke-width="4" opacity="0.3"/>
            <circle cx="128" cy="128" r="80" fill="none" stroke="#fff" stroke-width="2" opacity="0.15"/>
        </svg>`;
    }

    const base64 = Buffer.from(svg).toString("base64");
    return `data:image/svg+xml;base64,${base64}`;
}

export async function POST(req: NextRequest) {
    const rateLimited = await withRateLimit("generate-texture", req, { limit: 20, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const authCheck = await requireAuthenticatedUser();
    if (authCheck.error) {
        return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
    }

    const { data, error: jsonError } = await parseJsonSafely<{ prompt?: string }>(req, 10 * 1024);
    if (jsonError) return jsonError;

    const prompt = data?.prompt;
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        return createErrorResponse("INVALID_PROMPT", "Prompt is required", 400);
    }

    if (prompt.length > 200) {
        return createErrorResponse("PROMPT_TOO_LONG", "Prompt cannot exceed 200 characters", 400);
    }

    // 100% Deterministic local procedural texture generation (zero AI runtime dependencies)
    const textureUrl = generateProceduralSvgTexture(prompt.trim());

    return NextResponse.json({
        success: true,
        textureUrl,
        mode: "procedural-local",
    });
}
