import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser, requireOwnedProject } from "@/lib/auth-guards";
import { validateMutationOrigin } from "@/lib/csrf";
import { createErrorResponse, parseJsonSafely, LIMITS } from "@/lib/validation";
import type { SchemaField } from "@/types/schema";

const VALID_FIELD_TYPES = new Set(["text", "image", "link", "3d-model", "list"]);

function validateSchemaField(field: unknown, index: number): string | null {
    if (!field || typeof field !== "object") {
        return `Field at index ${index} is not an object`;
    }
    const f = field as Record<string, unknown>;

    if (!f.id || typeof f.id !== "string" || f.id.trim() === "") {
        return `Field at index ${index} is missing a valid "id"`;
    }
    if (f.id.length > LIMITS.FIELD_ID_MAX_LENGTH) {
        return `Field ID "${f.id}" exceeds ${LIMITS.FIELD_ID_MAX_LENGTH} characters`;
    }

    if (!f.type || typeof f.type !== "string" || !VALID_FIELD_TYPES.has(f.type)) {
        return `Field "${f.id}" has invalid type "${f.type}". Must be one of: ${Array.from(VALID_FIELD_TYPES).join(", ")}`;
    }

    if (f.selector && (typeof f.selector !== "string" || f.selector.length > LIMITS.SELECTOR_MAX_LENGTH)) {
        return `Field "${f.id}" has invalid or overly long selector`;
    }

    if (f.label && (typeof f.label !== "string" || f.label.length > LIMITS.LABEL_MAX_LENGTH)) {
        return `Field "${f.id}" has invalid or overly long label`;
    }

    if (f.value !== undefined && f.value !== null && typeof f.value !== "string") {
        return `Field "${f.id}" value must be a string`;
    }

    if (typeof f.value === "string" && f.value.length > LIMITS.TEXT_VALUE_MAX_LENGTH) {
        return `Field "${f.id}" value exceeds maximum length of ${LIMITS.TEXT_VALUE_MAX_LENGTH} characters`;
    }

    return null;
}

export async function GET(
    _req: NextRequest,
    { params }: { params: { projectId: string } }
) {
    const authCheck = await requireAuthenticatedUser();
    if (authCheck.error) {
        return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
    }
    const userId = authCheck.userId;

    const projectCheck = await requireOwnedProject(params.projectId, userId);
    if (projectCheck.error) {
        return createErrorResponse(projectCheck.error.code, projectCheck.error.message, projectCheck.error.status);
    }

    const project = projectCheck.project;
    const schema = (project.generatedSchema as unknown as SchemaField[]) || [];

    return NextResponse.json({
        success: true,
        schema,
        schemaRevision: project.schemaRevision,
        updatedAt: project.updatedAt,
    });
}

export async function PUT(
    req: NextRequest,
    { params }: { params: { projectId: string } }
) {
    const csrfError = validateMutationOrigin(req);
    if (csrfError) return csrfError;

    const authCheck = await requireAuthenticatedUser();
    if (authCheck.error) {
        return createErrorResponse(authCheck.error.code, authCheck.error.message, authCheck.error.status);
    }
    const userId = authCheck.userId;

    const projectCheck = await requireOwnedProject(params.projectId, userId);
    if (projectCheck.error) {
        return createErrorResponse(projectCheck.error.code, projectCheck.error.message, projectCheck.error.status);
    }
    const currentProject = projectCheck.project;

    const { data, error: jsonError } = await parseJsonSafely<{
        schema?: unknown[];
        clientRevision?: number;
    }>(req, LIMITS.SCHEMA_MAX_BYTES);
    if (jsonError) return jsonError;

    const schema = data?.schema;
    const clientRevision = data?.clientRevision;

    if (!schema || !Array.isArray(schema)) {
        return createErrorResponse("INVALID_SCHEMA", "schema must be an array of fields", 400);
    }

    if (schema.length > LIMITS.SCHEMA_MAX_FIELDS) {
        return createErrorResponse("SCHEMA_TOO_LARGE", `Schema exceeds maximum of ${LIMITS.SCHEMA_MAX_FIELDS} fields`, 400);
    }

    // Stale-write rejection for autosave consistency
    if (clientRevision !== undefined && typeof clientRevision === "number") {
        if (clientRevision < currentProject.schemaRevision) {
            return NextResponse.json(
                {
                    success: false,
                    errorCode: "STALE_REVISION",
                    message: `Stale write rejected: server revision (${currentProject.schemaRevision}) is ahead of client revision (${clientRevision})`,
                    serverRevision: currentProject.schemaRevision,
                },
                { status: 409 }
            );
        }
    }

    // Validate each field
    const fieldErrors: Record<string, string> = {};
    for (let i = 0; i < schema.length; i++) {
        const error = validateSchemaField(schema[i], i);
        if (error) fieldErrors[`field_${i}`] = error;
    }

    if (Object.keys(fieldErrors).length > 0) {
        return createErrorResponse("VALIDATION_FAILED", "Schema field validation failed", 400, fieldErrors);
    }

    // Deduplicate fields by id and selector binding
    const seenIds = new Set<string>();
    const seenSelectors = new Set<string>();
    const cleanFields: SchemaField[] = [];

    for (const rawField of schema) {
        const f = rawField as SchemaField;
        if (seenIds.has(f.id)) continue;
        seenIds.add(f.id);

        if (f.selector) {
            if (seenSelectors.has(f.selector)) {
                // If same selector already mapped to another field, skip duplicate
                continue;
            }
            seenSelectors.add(f.selector);
        }

        cleanFields.push({
            id: f.id.trim(),
            type: f.type,
            label: f.label ? String(f.label).trim() : f.id.trim(),
            selector: f.selector ? String(f.selector).trim() : undefined,
            originalHtmlTag: f.originalHtmlTag ? String(f.originalHtmlTag).trim() : undefined,
            value: f.value !== undefined && f.value !== null ? String(f.value) : "",
            path: f.path ? String(f.path) : undefined,
            sourceBinding: f.sourceBinding,
            alt: f.alt !== undefined ? String(f.alt) : undefined,
            objectFit: f.objectFit !== undefined ? String(f.objectFit) : undefined,
            borderRadius: f.borderRadius !== undefined ? String(f.borderRadius) : undefined,
            roughness: f.roughness !== undefined ? Number(f.roughness) : undefined,
            metalness: f.metalness !== undefined ? Number(f.metalness) : undefined,
            textureUrl: f.textureUrl !== undefined ? String(f.textureUrl) : undefined,
        });
    }

    const nextRevision = (currentProject.schemaRevision || 0) + 1;

    try {
        const updated = await prisma.project.update({
            where: { id: params.projectId },
            data: {
                generatedSchema: cleanFields as unknown as import("@prisma/client").Prisma.InputJsonValue,
                schemaRevision: nextRevision,
            },
        });

        return NextResponse.json({
            success: true,
            fieldCount: cleanFields.length,
            schemaRevision: updated.schemaRevision,
            updatedAt: updated.updatedAt,
        });
    } catch (error: unknown) {
        console.error("Failed to update project schema:", error);
        return createErrorResponse("DB_ERROR", "Failed to persist schema to database", 500);
    }
}
