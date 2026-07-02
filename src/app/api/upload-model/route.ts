import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getAuthorizedUser } from "@/auth";
import { Document, NodeIO } from "@gltf-transform/core";
import { weld, dedup, prune, quantize } from "@gltf-transform/functions";

const ALLOWED_EXTENSIONS = [".glb", ".gltf"];
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * Optimizes a GLB buffer to a target LOD level.
 *
 * - "medium": weld + dedup (moderate optimization, ~60-80% original quality)
 * - "low": weld + dedup + prune + quantize (aggressive optimization, ~30-50% original quality)
 */
async function optimizeGlb(
    buffer: Uint8Array,
    level: "medium" | "low"
): Promise<Uint8Array> {
    const io = new NodeIO();
    const document: Document = await io.readBinary(buffer);

    // Medium: weld (merge identical vertices) + dedup (merge duplicate accessors)
    await document.transform(
        weld({ overwrite: true }),
        dedup(),
    );

    if (level === "low") {
        // Additional aggressive optimizations for low-poly
        await document.transform(
            prune(),
            quantize(),
        );
    }

    return await io.writeBinary(document);
}

export async function POST(req: NextRequest) {
    // Local dev only. For production, replace with S3/Cloudflare R2/Supabase Storage and return a CDN URL.
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
        return NextResponse.json(
            { error: "Local filesystem storage is blocked in production. Configure cloud storage (e.g. S3, Cloudflare R2, Supabase) to save 3D models." },
            { status: 403 }
        );
    }

    try {
        const userId = await getAuthorizedUser();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get("model") as File | null;
        const projectId = formData.get("projectId") as string | null;
        const modelName = formData.get("name") as string | "Untitled Model";

        if (!file || !projectId) {
            return NextResponse.json(
                { error: "Missing file or projectId" },
                { status: 400 }
            );
        }

        // Validate extension
        const ext = path.extname(file.name).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return NextResponse.json(
                { error: "Invalid file type. Only .glb and .gltf are allowed." },
                { status: 400 }
            );
        }

        // Validate size
        if (file.size > MAX_SIZE_BYTES) {
            return NextResponse.json(
                { error: "File exceeds 50MB limit." },
                { status: 400 }
            );
        }

        // 1. Create Asset3D record in DB first to get ID
        const dbAsset = await prisma.asset3D.create({
            data: {
                name: modelName,
                projectId: projectId,
            },
        });

        // 2. Setup Storage
        const uploadDir = path.join(process.cwd(), "public", "models", dbAsset.id);
        await mkdir(uploadDir, { recursive: true });

        // 3. Save High Poly (Original)
        const buffer = Buffer.from(await file.arrayBuffer());
        const timestamp = Date.now();
        const highPolyFilename = `high_${timestamp}${ext}`;
        const highPolyPath = path.join(uploadDir, highPolyFilename);
        await writeFile(highPolyPath, buffer);

        // 4. LOD Pipeline — Actual mesh optimization with fallback
        const medPolyFilename = `medium_${timestamp}${ext}`;
        const lowPolyFilename = `low_${timestamp}${ext}`;
        const medPath = path.join(uploadDir, medPolyFilename);
        const lowPath = path.join(uploadDir, lowPolyFilename);

        let lodSuccess = false;

        if (ext === ".glb") {
            try {
                // Generate medium-poly version (weld + dedup)
                console.log(`[LOD] Generating medium-poly for asset ${dbAsset.id}...`);
                const medBuffer = await optimizeGlb(new Uint8Array(buffer), "medium");
                await writeFile(medPath, Buffer.from(medBuffer));

                // Generate low-poly version (weld + dedup + prune + quantize)
                console.log(`[LOD] Generating low-poly for asset ${dbAsset.id}...`);
                const lowBuffer = await optimizeGlb(new Uint8Array(buffer), "low");
                await writeFile(lowPath, Buffer.from(lowBuffer));

                lodSuccess = true;
                console.log(`[LOD] ✓ Pipeline complete for asset ${dbAsset.id}`);
                console.log(`[LOD]   High: ${buffer.length} bytes`);
                console.log(`[LOD]   Medium: ${medBuffer.length} bytes (${Math.round((medBuffer.length / buffer.length) * 100)}%)`);
                console.log(`[LOD]   Low: ${lowBuffer.length} bytes (${Math.round((lowBuffer.length / buffer.length) * 100)}%)`);
            } catch (lodError) {
                console.warn(`[LOD] Mesh optimization failed, falling back to copy:`, lodError);
            }
        }

        // Fallback: copy original if optimization failed or file is .gltf
        if (!lodSuccess) {
            const { copyFile } = await import("fs/promises");
            await copyFile(highPolyPath, medPath);
            await copyFile(highPolyPath, lowPath);
            console.log(`[LOD] Used copy fallback for asset ${dbAsset.id} (${ext} format or optimizer error)`);
        }

        // 5. Update DB with URLs
        const baseUrl = `/models/${dbAsset.id}`;
        const updatedAsset = await prisma.asset3D.update({
            where: { id: dbAsset.id },
            data: {
                urlHighPoly: `${baseUrl}/${highPolyFilename}`,
                urlMediumPoly: `${baseUrl}/${medPolyFilename}`,
                urlLowPoly: `${baseUrl}/${lowPolyFilename}`,
            },
        });

        return NextResponse.json(
            {
                ...updatedAsset,
                path: updatedAsset.urlHighPoly,
                lodOptimized: lodSuccess,
            },
            { status: 201 }
        );
    } catch (err) {
        console.error("Model upload error:", err);
        return NextResponse.json(
            { error: "Internal server error during 3D model processing." },
            { status: 500 }
        );
    }
}
