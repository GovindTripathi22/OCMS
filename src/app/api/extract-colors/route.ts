import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth-guards";
import { withRateLimit } from "@/lib/ratelimit";
import { createErrorResponse, parseJsonSafely } from "@/lib/validation";

// ---------------------------------------------------------------------------
// Curated palette map – ~12 keyword themes, each mapping to a 5-color palette
// Order: [background, primary, secondary, accent, text]
// ---------------------------------------------------------------------------
const CURATED_PALETTES: Record<string, string[]> = {
    // Technology / digital
    tech:          ["#0A0A0F", "#00F0FF", "#7B61FF", "#1A1A2E", "#E0E0E0"],
    digital:       ["#0A0A0F", "#00F0FF", "#7B61FF", "#1A1A2E", "#E0E0E0"],
    cyber:         ["#0A0A0F", "#00F0FF", "#7B61FF", "#1A1A2E", "#E0E0E0"],
    startup:       ["#0A0A0F", "#00F0FF", "#7B61FF", "#1A1A2E", "#E0E0E0"],
    app:           ["#0A0A0F", "#00F0FF", "#7B61FF", "#1A1A2E", "#E0E0E0"],
    saas:          ["#0A0A0F", "#00F0FF", "#7B61FF", "#1A1A2E", "#E0E0E0"],
    software:      ["#0A0A0F", "#00F0FF", "#7B61FF", "#1A1A2E", "#E0E0E0"],

    // Luxury / premium
    luxury:        ["#1A1A1A", "#C5A55A", "#2D2D2D", "#F5E6CC", "#FFFFFF"],
    premium:       ["#1A1A1A", "#C5A55A", "#2D2D2D", "#F5E6CC", "#FFFFFF"],
    gold:          ["#1A1A1A", "#C5A55A", "#2D2D2D", "#F5E6CC", "#FFFFFF"],

    // Nature / eco
    nature:        ["#F0F4E8", "#2D6A4F", "#95D5B2", "#1B4332", "#2D3436"],
    green:         ["#F0F4E8", "#2D6A4F", "#95D5B2", "#1B4332", "#2D3436"],
    eco:           ["#F0F4E8", "#2D6A4F", "#95D5B2", "#1B4332", "#2D3436"],

    // Minimal / clean
    minimal:       ["#FFFFFF", "#000000", "#F5F5F5", "#333333", "#666666"],
    clean:         ["#FFFFFF", "#000000", "#F5F5F5", "#333333", "#666666"],
    simple:        ["#FFFFFF", "#000000", "#F5F5F5", "#333333", "#666666"],

    // Warm / cozy / autumn
    warm:          ["#FFF8F0", "#E07A5F", "#F2CC8F", "#3D405B", "#81B29A"],
    cozy:          ["#FFF8F0", "#E07A5F", "#F2CC8F", "#3D405B", "#81B29A"],
    autumn:        ["#FFF8F0", "#E07A5F", "#F2CC8F", "#3D405B", "#81B29A"],

    // Cool / ocean / blue
    cool:          ["#EBF5FB", "#1A73E8", "#4FC3F7", "#0D47A1", "#263238"],
    ocean:         ["#EBF5FB", "#1A73E8", "#4FC3F7", "#0D47A1", "#263238"],
    blue:          ["#EBF5FB", "#1A73E8", "#4FC3F7", "#0D47A1", "#263238"],

    // Pastel / soft / light
    pastel:        ["#FFF0F5", "#FFB6C1", "#B5EAD7", "#C7CEEA", "#2D3436"],
    soft:          ["#FFF0F5", "#FFB6C1", "#B5EAD7", "#C7CEEA", "#2D3436"],
    light:         ["#FFF0F5", "#FFB6C1", "#B5EAD7", "#C7CEEA", "#2D3436"],

    // Dark / night / midnight
    dark:          ["#0D0D0D", "#BB86FC", "#03DAC6", "#1F1F1F", "#E0E0E0"],
    night:         ["#0D0D0D", "#BB86FC", "#03DAC6", "#1F1F1F", "#E0E0E0"],
    midnight:      ["#0D0D0D", "#BB86FC", "#03DAC6", "#1F1F1F", "#E0E0E0"],

    // Neobrutalist / bold / punk
    neobrutalist:  ["#FFFF00", "#FF6B6B", "#000000", "#FFFFFF", "#4ECDC4"],
    bold:          ["#FFFF00", "#FF6B6B", "#000000", "#FFFFFF", "#4ECDC4"],
    punk:          ["#FFFF00", "#FF6B6B", "#000000", "#FFFFFF", "#4ECDC4"],

    // Corporate / business / professional
    corporate:     ["#FAFAFA", "#1565C0", "#E3F2FD", "#0D47A1", "#212121"],
    business:      ["#FAFAFA", "#1565C0", "#E3F2FD", "#0D47A1", "#212121"],
    professional:  ["#FAFAFA", "#1565C0", "#E3F2FD", "#0D47A1", "#212121"],
    finance:       ["#FAFAFA", "#1565C0", "#E3F2FD", "#0D47A1", "#212121"],
    bank:          ["#FAFAFA", "#1565C0", "#E3F2FD", "#0D47A1", "#212121"],
    wealth:        ["#FAFAFA", "#1565C0", "#E3F2FD", "#0D47A1", "#212121"],
    money:         ["#FAFAFA", "#1565C0", "#E3F2FD", "#0D47A1", "#212121"],
    investment:    ["#FAFAFA", "#1565C0", "#E3F2FD", "#0D47A1", "#212121"],

    // Retro / vintage / nostalgia
    retro:         ["#FAEBD7", "#D4A574", "#8B4513", "#F4A460", "#2F1B14"],
    vintage:       ["#FAEBD7", "#D4A574", "#8B4513", "#F4A460", "#2F1B14"],
    nostalgia:     ["#FAEBD7", "#D4A574", "#8B4513", "#F4A460", "#2F1B14"],

    // Neon / vibrant / party
    neon:          ["#0D0D0D", "#FF00FF", "#00FF41", "#FFD700", "#FFFFFF"],
    vibrant:       ["#0D0D0D", "#FF00FF", "#00FF41", "#FFD700", "#FFFFFF"],
    party:         ["#0D0D0D", "#FF00FF", "#00FF41", "#FFD700", "#FFFFFF"],
};

function hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return hash >>> 0;
}

function hslToHex(h: number, s: number, l: number): string {
    const sNorm = s / 100;
    const lNorm = l / 100;
    const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = lNorm - c / 2;

    let r = 0, g = 0, b = 0;
    if (h < 60)       { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else              { r = c; b = x; }

    const toHex = (v: number) =>
        Math.round((v + m) * 255)
            .toString(16)
            .padStart(2, "0");

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function generateHarmonyPalette(hue: number): string[] {
    return [
        hslToHex(hue, 10, 96),
        hslToHex(hue, 70, 45),
        hslToHex((hue + 30) % 360, 50, 60),
        hslToHex((hue + 180) % 360, 65, 50),
        hslToHex(hue, 15, 15),
    ];
}

function matchPalette(description: string): string[] {
    const lower = description.toLowerCase();
    const paletteScores = new Map<string, number>();
    let bestKey = "";
    let bestScore = 0;

    for (const keyword of Object.keys(CURATED_PALETTES)) {
        const regex = new RegExp(`\\b${keyword}\\b`, "i");
        if (regex.test(lower)) {
            const paletteKey = CURATED_PALETTES[keyword].join(",");
            const current = (paletteScores.get(paletteKey) ?? 0) + 1;
            paletteScores.set(paletteKey, current);

            if (current > bestScore) {
                bestScore = current;
                bestKey = keyword;
            }
        }
    }

    if (bestKey) {
        return CURATED_PALETTES[bestKey];
    }

    const hue = hashString(lower) % 360;
    return generateHarmonyPalette(hue);
}

export async function POST(req: NextRequest) {
    const rateLimited = await withRateLimit("extract-colors", req, { limit: 30, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const authCheck = await requireAuthenticatedUser();
    if (authCheck.error) {
        return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
    }

    const { data, error: jsonError } = await parseJsonSafely<{ brandDescription?: string }>(req, 10 * 1024);
    if (jsonError) return jsonError;

    const brandDescription = data?.brandDescription?.trim();
    if (!brandDescription) {
        return createErrorResponse("INVALID_INPUT", "brandDescription is required", 400);
    }

    if (brandDescription.length > 500) {
        return createErrorResponse("INPUT_TOO_LONG", "brandDescription cannot exceed 500 characters", 400);
    }

    const colors = matchPalette(brandDescription);

    return NextResponse.json({
        success: true,
        colors,
    });
}
