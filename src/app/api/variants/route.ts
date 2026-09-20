import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser, requireOwnedAsset } from "@/lib/auth-guards";
import { validateMutationOrigin } from "@/lib/csrf";
import { createErrorResponse, LIMITS, parseJsonSafely, HEX_COLOR_REGEX } from "@/lib/validation";

interface MaterialPropertiesInput {
    roughness?: number;
    metalness?: number;
    color?: string;
    [key: string]: unknown;
}

interface VariantCreateInput {
    assetId: string;
    variantName: string;
    textureUrl?: string;
    materialProperties?: MaterialPropertiesInput;
}

function validateTextureUrl(urlStr?: string): boolean {
    if (!urlStr) return true;
    const trimmed = urlStr.trim();
    if (trimmed.startsWith("data:image/svg+xml") || trimmed.startsWith("data:image/png") || trimmed.startsWith("data:image/jpeg")) {
        return trimmed.length < 500 * 1024; // max 500KB data URI
    }
    if (trimmed.startsWith("/")) {
        return !trimmed.includes("..");
    }
    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

function validateMaterialProperties(props?: unknown): { valid: boolean; cleaned?: Record<string, unknown>; error?: string } {
    if (!props) return { valid: true, cleaned: {} };
    if (typeof props !== "object" || Array.isArray(props)) {
        return { valid: false, error: "materialProperties must be an object" };
    }

    const raw = props as Record<string, unknown>;
    const cleaned: Record<string, unknown> = {};

    if ("roughness" in raw) {
        const r = Number(raw.roughness);
        if (isNaN(r) || r < 0 || r > 1) {
            return { valid: false, error: "roughness must be a number between 0 and 1" };
        }
        cleaned.roughness = r;
    }

    if ("metalness" in raw) {
        const m = Number(raw.metalness);
        if (isNaN(m) || m < 0 || m > 1) {
            return { valid: false, error: "metalness must be a number between 0 and 1" };
        }
        cleaned.metalness = m;
    }

    if ("color" in raw && raw.color !== undefined && raw.color !== null) {
        const c = String(raw.color).trim();
        if (!HEX_COLOR_REGEX.test(c)) {
            return { valid: false, error: "color must be a valid hex color string" };
        }
        cleaned.color = c;
    }

    return { valid: true, cleaned };
}

/**
 * POST /api/variants
 * Creates a new 3D model material variant.
 * Enforces strict user -> project -> asset ownership chain.
 */
export async function POST(req: NextRequest) {
    const csrfError = validateMutationOrigin(req);
    if (csrfError) return csrfError;

    const authCheck = await requireAuthenticatedUser();
    if (authCheck.error) {
        return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
    }
    const userId = authCheck.userId;

    const { data, error: jsonError } = await parseJsonSafely<VariantCreateInput>(req, 100 * 1024);
    if (jsonError) return jsonError;

    const assetId = data?.assetId?.trim();
    const variantName = data?.variantName?.trim();
    const textureUrl = data?.textureUrl?.trim();
    const materialProperties = data?.materialProperties;

    if (!assetId || !variantName) {
        return createErrorResponse("MISSING_FIELDS", "assetId and variantName are required", 400);
    }

    if (variantName.length > LIMITS.VARIANT_NAME_MAX_LENGTH) {
        return createErrorResponse("NAME_TOO_LONG", `variantName cannot exceed ${LIMITS.VARIANT_NAME_MAX_LENGTH} characters`, 400);
    }

    if (textureUrl && !validateTextureUrl(textureUrl)) {
        return createErrorResponse("INVALID_TEXTURE_URL", "textureUrl is invalid or unsupported format", 400);
    }

    const matValidation = validateMaterialProperties(materialProperties);
    if (!matValidation.valid) {
        return createErrorResponse("INVALID_MATERIAL_PROPERTIES", matValidation.error || "Invalid material properties", 400);
    }

    // Strict Ownership Chain: Asset must already exist and belong to a project owned by this user
    // Never create placeholder assets from arbitrary assetId!
    const assetCheck = await requireOwnedAsset(assetId, userId);
    if (assetCheck.error) {
        return createErrorResponse(assetCheck.error.code, assetCheck.error.message, assetCheck.error.status);
    }

    try {
        const variant = await prisma.modelVariant.create({
            data: {
                assetId,
                variantName,
                textureUrl: textureUrl || null,
                materialProperties: matValidation.cleaned as import("@prisma/client").Prisma.InputJsonValue,
            },
        });

        return NextResponse.json(variant, { status: 201 });
    } catch (dbErr) {
        console.error("Variant creation database error:", dbErr);
        return createErrorResponse("DB_ERROR", "Failed to create model variant", 500);
    }
}

/**
 * GET /api/variants?assetId=...
 * Fetches variants for an asset. Requires authentication and asset ownership.
 */
export async function GET(req: NextRequest) {
    const authCheck = await requireAuthenticatedUser();
    if (authCheck.error) {
        return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
    }
    const userId = authCheck.userId;

    const { searchParams } = new URL(req.url);
    const assetId = searchParams.get("assetId")?.trim();

    if (!assetId) {
        return createErrorResponse("MISSING_ASSET_ID", "assetId parameter is required", 400);
    }

    // Verify ownership of the asset before returning its variants
    const assetCheck = await requireOwnedAsset(assetId, userId);
    if (assetCheck.error) {
        return createErrorResponse(assetCheck.error.code, assetCheck.error.message, assetCheck.error.status);
    }

    try {
        const variants = await prisma.modelVariant.findMany({
            where: { assetId },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(variants, { status: 200 });
    } catch (err) {
        console.error("Fetch variants error:", err);
        return createErrorResponse("DB_ERROR", "Failed to fetch model variants", 500);
    }
}
