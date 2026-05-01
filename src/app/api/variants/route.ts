import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

/**
 * API Route to manage 3D Model Variants (textures/materials).
 */
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { assetId, variantName, textureUrl, materialProperties } = body;

        if (!assetId || !variantName) {
            return NextResponse.json(
                { error: "Missing assetId or variantName" },
                { status: 400 }
            );
        }

        // Verify the asset exists
        const asset = await prisma.asset3D.findUnique({
            where: { id: assetId }
        });

        if (!asset) {
            return NextResponse.json(
                { error: "Asset not found" },
                { status: 404 }
            );
        }

        // Create the variant
        const variant = await prisma.modelVariant.create({
            data: {
                assetId,
                variantName,
                textureUrl,
                materialProperties: materialProperties || {},
            }
        });

        return NextResponse.json(variant, { status: 201 });
    } catch (err) {
        console.error("Variant creation error:", err);
        return NextResponse.json(
            { error: "Internal server error during variant management." },
            { status: 500 }
        );
    }
}

/**
 * GET variants for a specific model.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const assetId = searchParams.get("assetId");

        if (!assetId) {
            return NextResponse.json(
                { error: "Missing assetId parameter" },
                { status: 400 }
            );
        }

        const variants = await prisma.modelVariant.findMany({
            where: { assetId },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json(variants, { status: 200 });
    } catch (err) {
        console.error("Fetch variants error:", err);
        return NextResponse.json(
            { error: "Internal server error while fetching variants." },
            { status: 500 }
        );
    }
}
