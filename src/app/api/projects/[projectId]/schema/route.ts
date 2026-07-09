import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedUser } from "@/auth";

const VALID_FIELD_TYPES = new Set(["text", "image", "link", "3d-model", "list"]);

interface SchemaFieldInput {
    id: string;
    type: string;
    selector?: string;
    label?: string;
    value?: string;
    path?: string;
    [key: string]: unknown;
}

function validateSchemaField(field: unknown, index: number): string | null {
    if (!field || typeof field !== "object") {
        return `Field at index ${index} is not an object`;
    }
    const f = field as SchemaFieldInput;
    if (!f.id || typeof f.id !== "string" || f.id.trim() === "") {
        return `Field at index ${index} is missing a valid "id"`;
    }
    if (!f.type || !VALID_FIELD_TYPES.has(f.type)) {
        return `Field "${f.id}" has invalid type "${f.type}". Must be one of: ${Array.from(VALID_FIELD_TYPES).join(", ")}`;
    }
    return null;
}

export async function PUT(
    req: NextRequest,
    { params }: { params: { projectId: string } }
) {
    try {
        const userId = await getAuthorizedUser();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { schema } = body;

        if (!schema) {
            return NextResponse.json({ error: "Schema is required" }, { status: 400 });
        }

        if (!Array.isArray(schema)) {
            return NextResponse.json(
                { error: "Schema must be an array of fields" },
                { status: 400 }
            );
        }

        // Validate each field
        const validationErrors: string[] = [];
        for (let i = 0; i < schema.length; i++) {
            const error = validateSchemaField(schema[i], i);
            if (error) validationErrors.push(error);
        }

        if (validationErrors.length > 0) {
            return NextResponse.json(
                {
                    error: "Schema validation failed",
                    details: validationErrors,
                },
                { status: 400 }
            );
        }

        // Verify project ownership
        const existingProject = await prisma.project.findFirst({
            where: {
                id: params.projectId,
                userId: userId,
            }
        });

        if (!existingProject) {
            return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
        }

        // Deduplicate fields by id (keep last occurrence)
        const seenIds = new Map<string, SchemaFieldInput>();
        for (const field of schema as SchemaFieldInput[]) {
            seenIds.set(field.id, field);
        }
        const deduplicatedSchema = Array.from(seenIds.values());

        const project = await prisma.project.update({
            where: { id: params.projectId },
            data: {
                generatedSchema: deduplicatedSchema as unknown as import("@prisma/client").Prisma.InputJsonValue,
            },
        });

        return NextResponse.json({
            success: true,
            fieldCount: deduplicatedSchema.length,
            project: { id: project.id, updatedAt: project.updatedAt },
        });
    } catch (error: unknown) {
        console.error("Failed to update project schema:", error);
        return NextResponse.json(
            { error: "Failed to update project schema" },
            { status: 500 }
        );
    }
}
