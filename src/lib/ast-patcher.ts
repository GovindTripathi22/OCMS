import generate from "@babel/generator";
import {
    findJSXElements,
    normalizeText,
    parseTSX,
    readJSXElementValue,
    writeJSXElementValue,
} from "@/lib/jsx-ast-helpers";

export interface ASTChange {
    type: "text" | "image" | "link" | "3d-model";
    selector: string;
    newValue: string;
    oldValue?: string;
    alt?: string;
    objectFit?: string;
    borderRadius?: string;
}

export interface PatchReport {
    code: string;
    appliedCount: number;
    matchedSelectors: string[];
    unmatchedSelectors: string[];
}

export function patchJSX(sourceCode: string, changes: ASTChange[]): string {
    return patchJSXWithReport(sourceCode, changes).code;
}

export function patchJSXWithReport(sourceCode: string, changes: ASTChange[]): PatchReport {
    const ast = parseTSX(sourceCode);
    const matchedSelectors = new Set<string>();
    const unmatchedSelectors = new Set<string>();
    let appliedCount = 0;

    for (const change of changes) {
        if (!change.selector || change.newValue === undefined || change.newValue === null) continue;

        const candidates = findJSXElements(ast, change.selector);
        const target = chooseTarget(candidates, change);
        if (!target) {
            unmatchedSelectors.add(change.selector);
            continue;
        }

        writeJSXElementValue(target, change.type, change.newValue, {
            alt: change.alt,
            objectFit: change.objectFit,
            borderRadius: change.borderRadius,
        });
        matchedSelectors.add(change.selector);
        appliedCount++;
    }

    const code = generate(
        ast,
        {
            retainLines: true,
            jsescOption: { minimal: true },
        },
        sourceCode
    ).code;

    return {
        code,
        appliedCount,
        matchedSelectors: Array.from(matchedSelectors),
        unmatchedSelectors: Array.from(unmatchedSelectors),
    };
}

function chooseTarget(
    candidates: ReturnType<typeof findJSXElements>,
    change: ASTChange
): ReturnType<typeof findJSXElements>[number] | null {
    if (!candidates.length) return null;

    if (change.oldValue) {
        const normalizedOld = normalizeText(change.oldValue);
        const oldValueMatch = candidates.find((candidate) => {
            const currentValue = readJSXElementValue(candidate, change.type);
            return currentValue !== null && normalizeText(currentValue) === normalizedOld;
        });

        if (oldValueMatch) return oldValueMatch;
    }

    return candidates[0] ?? null;
}
