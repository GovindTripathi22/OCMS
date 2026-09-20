import { getAuthorizedUser } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Project, Asset3D, ModelVariant } from "@prisma/client";

export interface OwnershipError {
    code: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND";
    message: string;
    status: number;
}

export async function requireAuthenticatedUser(): Promise<
    { userId: string; error: null } | { userId: null; error: OwnershipError }
> {
    const userId = await getAuthorizedUser();
    if (!userId) {
        return {
            userId: null,
            error: {
                code: "UNAUTHORIZED",
                message: "Authentication required to access this resource",
                status: 401,
            },
        };
    }
    return { userId, error: null };
}

export async function requireOwnedProject(
    projectId: string,
    userId: string
): Promise<
    { project: Project; error: null } | { project: null; error: OwnershipError }
> {
    if (!projectId) {
        return {
            project: null,
            error: {
                code: "NOT_FOUND",
                message: "Project ID is required",
                status: 400,
            },
        };
    }

    const project = await prisma.project.findUnique({
        where: { id: projectId },
    });

    if (!project) {
        return {
            project: null,
            error: {
                code: "NOT_FOUND",
                message: "Project not found",
                status: 404,
            },
        };
    }

    if (project.userId !== userId) {
        return {
            project: null,
            error: {
                code: "FORBIDDEN",
                message: "You do not have access to this project",
                status: 403,
            },
        };
    }

    return { project, error: null };
}

export async function requireOwnedAsset(
    assetId: string,
    userId: string
): Promise<
    { asset: Asset3D & { project: Project }; error: null } | { asset: null; error: OwnershipError }
> {
    if (!assetId) {
        return {
            asset: null,
            error: {
                code: "NOT_FOUND",
                message: "Asset ID is required",
                status: 400,
            },
        };
    }

    const asset = await prisma.asset3D.findUnique({
        where: { id: assetId },
        include: { project: true },
    });

    if (!asset) {
        return {
            asset: null,
            error: {
                code: "NOT_FOUND",
                message: "3D Asset not found",
                status: 404,
            },
        };
    }

    if (asset.project.userId !== userId) {
        return {
            asset: null,
            error: {
                code: "FORBIDDEN",
                message: "You do not have access to this 3D asset",
                status: 403,
            },
        };
    }

    return { asset, error: null };
}

export async function requireOwnedVariant(
    variantId: string,
    userId: string
): Promise<
    {
        variant: ModelVariant & {
            asset: Asset3D & { project: Project };
        };
        error: null;
    } | { variant: null; error: OwnershipError }
> {
    if (!variantId) {
        return {
            variant: null,
            error: {
                code: "NOT_FOUND",
                message: "Variant ID is required",
                status: 400,
            },
        };
    }

    const variant = await prisma.modelVariant.findUnique({
        where: { id: variantId },
        include: {
            asset: {
                include: {
                    project: true,
                },
            },
        },
    });

    if (!variant) {
        return {
            variant: null,
            error: {
                code: "NOT_FOUND",
                message: "Model variant not found",
                status: 404,
            },
        };
    }

    if (variant.asset.project.userId !== userId) {
        return {
            variant: null,
            error: {
                code: "FORBIDDEN",
                message: "You do not have access to this model variant",
                status: 403,
            },
        };
    }

    return { variant, error: null };
}
