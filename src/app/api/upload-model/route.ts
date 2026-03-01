import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const ALLOWED_EXTENSIONS = [".glb", ".gltf"];
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("model") as File | null;
        const projectId = formData.get("projectId") as string | null;

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

        // Sanitize filename
        const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const timestamp = Date.now();
        const filename = `${timestamp}_${sanitized}`;

        // Ensure upload directory exists
        const uploadDir = path.join(process.cwd(), "public", "models", projectId);
        await mkdir(uploadDir, { recursive: true });

        // Write file
        const buffer = Buffer.from(await file.arrayBuffer());
        const filePath = path.join(uploadDir, filename);
        await writeFile(filePath, buffer);

        // Return public-accessible path
        const publicPath = `/models/${projectId}/${filename}`;

        return NextResponse.json({ path: publicPath }, { status: 200 });
    } catch (err) {
        console.error("Model upload error:", err);
        return NextResponse.json(
            { error: "Internal server error during upload." },
            { status: 500 }
        );
    }
}
