import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser, requireOwnedProject } from "@/lib/auth-guards";
import { Document, NodeIO } from "@gltf-transform/core";
import { weld, dedup, prune, quantize } from "@gltf-transform/functions";
import { withRateLimit } from "@/lib/ratelimit";
import { validateMutationOrigin } from "@/lib/csrf";
import { createErrorResponse, LIMITS } from "@/lib/validation";

const ALLOWED_EXTENSIONS = [".glb", ".gltf"];
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

async function optimizeGlb(
    buffer: Uint8Array,
    level: "medium" | "low"
): Promise<Uint8Array> {
    const io = new NodeIO();
    const document: Document = await io.readBinary(buffer);

    await document.transform(
        weld({ overwrite: true }),
        dedup()
    );

    if (level === "low") {
        await document.transform(
            prune(),
            quantize()
        );
    }

    return await io.writeBinary(document);
}

export async function POST(req: NextRequest) {
    const csrfError = validateMutationOrigin(req);
    if (csrfError) return csrfError;

    const rateLimited = await withRateLimit("upload-model", req, { limit: 10, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    // In serverless (Vercel, AWS Lambda), local disk is read-only
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
        return createErrorResponse(
            "SERVERLESS_STORAGE_UNSUPPORTED",
            "3D model file uploads require cloud object storage (S3/R2) in serverless deployments.",
            501
        );
    }

    // In production, local storage is only allowed if STORAGE_MODE === "local"
    const storageMode = process.env.STORAGE_MODE || (process.env.NODE_ENV === "production" ? "cloud" : "local");
    if (storageMode !== "local" && process.env.NODE_ENV === "production") {
        return createErrorResponse(
            "STORAGE_UNCONFIGURED",
            "Local filesystem storage is blocked in production. Configure cloud object storage (S3/R2) or set STORAGE_MODE=local.",
            403
        );
    }

    const authCheck = await requireAuthenticatedUser();
    if (authCheck.error) {
        return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
    }
    const userId = authCheck.userId;

    let formData: FormData;
    try {
        formData = await req.formData();
    } catch {
        return createErrorResponse("INVALID_FORM_DATA", "Malformed multipart form data", 400);
    }

    const file = formData.get("model") as File | null;
    const projectId = formData.get("projectId") as string | null;
    const rawModelName = (formData.get("name") as string | null)?.trim() || "Untitled Model";

    if (!file || !projectId) {
        return createErrorResponse("MISSING_FIELDS", "Missing file or projectId", 400);
    }

    // Strict Tenant Isolation: Project must exist and belong to the authenticated user
    const projectCheck = await requireOwnedProject(projectId, userId);
    if (projectCheck.error) {
        return createErrorResponse(projectCheck.error.code, projectCheck.error.message, projectCheck.error.status);
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return createErrorResponse("INVALID_FILE_TYPE", "Invalid file type. Only .glb and .gltf are allowed.", 400);
    }

    if (file.size > MAX_SIZE_BYTES) {
        return createErrorResponse("FILE_TOO_LARGE", "File exceeds 50MB limit.", 400);
    }

    const modelName = rawModelName.slice(0, LIMITS.MODEL_NAME_MAX_LENGTH);

    // Create DB Asset record with mandatory owned project ID
    let dbAsset;
    try {
        dbAsset = await prisma.asset3D.create({
            data: {
                name: modelName,
                projectId: projectId,
            },
        });
    } catch (dbErr) {
        console.error("[Asset3D DB Create Error]:", dbErr);
        return createErrorResponse("DB_ERROR", "Failed to initialize 3D asset record", 500);
    }

    const uploadDir = path.join(process.cwd(), "public", "models", dbAsset.id);

    try {
        await mkdir(uploadDir, { recursive: true });

        const buffer = Buffer.from(await file.arrayBuffer());
        const timestamp = Date.now();
        const highPolyFilename = `high_${timestamp}${ext}`;
        const highPolyPath = path.join(uploadDir, highPolyFilename);
        await writeFile(highPolyPath, buffer);

        const medPolyFilename = `medium_${timestamp}${ext}`;
        const lowPolyFilename = `low_${timestamp}${ext}`;
        const medPath = path.join(uploadDir, medPolyFilename);
        const lowPath = path.join(uploadDir, lowPolyFilename);

        let lodSuccess = false;

        if (ext === ".glb") {
            try {
                const medBuffer = await optimizeGlb(new Uint8Array(buffer), "medium");
                await writeFile(medPath, Buffer.from(medBuffer));

                const lowBuffer = await optimizeGlb(new Uint8Array(buffer), "low");
                await writeFile(lowPath, Buffer.from(lowBuffer));

                lodSuccess = true;
            } catch (lodError) {
                console.warn("[LOD] Mesh optimization failed, using copy fallback:", lodError);
            }
        }

        if (!lodSuccess) {
            const { copyFile } = await import("fs/promises");
            await copyFile(highPolyPath, medPath);
            await copyFile(highPolyPath, lowPath);
        }

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
                success: true,
                ...updatedAsset,
                path: updatedAsset.urlHighPoly,
                lodOptimized: lodSuccess,
            },
            { status: 201 }
        );
    } catch (err) {
        console.error("Model upload processing error, rolling back partial data:", err);

        // Robust cleanup of partial filesystem and database data
        try {
            await rm(uploadDir, { recursive: true, force: true });
        } catch (cleanupErr) {
            console.error("[Cleanup Error] Failed to delete upload directory:", cleanupErr);
        }

        try {
            await prisma.asset3D.delete({ where: { id: dbAsset.id } });
        } catch (dbDeleteErr) {
            console.error("[Cleanup Error] Failed to delete orphan Asset3D:", dbDeleteErr);
        }

        return createErrorResponse("PROCESSING_FAILED", "Failed to process 3D model asset", 500);
    }
}
