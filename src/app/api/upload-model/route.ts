import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, copyFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const ALLOWED_EXTENSIONS = [".glb", ".gltf"];
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
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
        const highPolyFilename = `high_${Date.now()}${ext}`;
        const highPolyPath = path.join(uploadDir, highPolyFilename);
        await writeFile(highPolyPath, buffer);

        // 4. Simulated LOD Pipeline (TODO: Integrate with Actual Mesh Optimizer)
        // For now, we simulate by copying the original file
        const medPolyFilename = `medium_${Date.now()}${ext}`;
        const lowPolyFilename = `low_${Date.now()}${ext}`;

        const medPath = path.join(uploadDir, medPolyFilename);
        const lowPath = path.join(uploadDir, lowPolyFilename);

        await copyFile(highPolyPath, medPath);
        await copyFile(highPolyPath, lowPath);

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
