import type { ASTChange } from "@/lib/ast-patcher";

export interface SourceChange {
    fieldId?: unknown;
    selector?: unknown;
    type?: unknown;
    newValue?: unknown;
    oldValue?: unknown;
    alt?: unknown;
    objectFit?: unknown;
    borderRadius?: unknown;
}

export function normalizeChanges(changes: SourceChange[]): ASTChange[] {
    return changes.reduce<ASTChange[]>((patches, change) => {
        if (typeof change.selector !== "string" || typeof change.newValue !== "string") return patches;

        const type = normalizeChangeType(change.type);
        if (!type) return patches;

        const patch: ASTChange = {
            type,
            selector: change.selector,
            newValue: change.newValue,
        };

        if (typeof change.oldValue === "string") patch.oldValue = change.oldValue;
        if (typeof change.alt === "string") patch.alt = change.alt;
        if (typeof change.objectFit === "string") patch.objectFit = change.objectFit;
        if (typeof change.borderRadius === "string") patch.borderRadius = change.borderRadius;

        patches.push(patch);

        return patches;
    }, []);
}

function normalizeChangeType(type: unknown): ASTChange["type"] | null {
    if (type === "text" || type === "image" || type === "link" || type === "3d-model") return type;
    if (type === "list") return "text";
    return null;
}
