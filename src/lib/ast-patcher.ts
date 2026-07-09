import generate from "@babel/generator";
import {
    findJSXElements,
    isInsideMappedExpression,
    normalizeText,
    parseTSX,
    readJSXElementValue,
    writeJSXElementValue,
    writeStaticMappedExpressionValue,
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

interface TargetChoice {
    target: ReturnType<typeof findJSXElements>[number] | null;
    reason?: string;
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
        const choice = chooseTarget(candidates, change);
        const target = choice.target;
        if (!target) {
            unmatchedSelectors.add(unmatchedSelector(change.selector, choice.reason));
            continue;
        }

        if (isInsideMappedExpression(target)) {
            const mappedWrite = writeStaticMappedExpressionValue(target, change.type, change.newValue, change.oldValue);
            if (!mappedWrite.applied) {
                unmatchedSelectors.add(unmatchedSelector(change.selector, mappedWrite.reason || "ambiguous: element renders via .map()"));
                continue;
            }
            matchedSelectors.add(change.selector);
            appliedCount++;
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
): TargetChoice {
    if (!candidates.length) return { target: null };

    if (change.oldValue) {
        const normalizedOld = normalizeText(change.oldValue);
        const oldValueMatch = candidates.find((candidate) => {
            const currentValue = readJSXElementValue(candidate, change.type);
            return currentValue !== null && normalizeText(currentValue) === normalizedOld;
        });

        if (oldValueMatch) return { target: oldValueMatch };
    }

    const mappedCandidates = candidates.filter(isInsideMappedExpression);
    if (mappedCandidates.length === 1) return { target: mappedCandidates[0] };
    if (mappedCandidates.length > 1) {
        return {
            target: null,
            reason: "ambiguous: element renders via .map()",
        };
    }

    return { target: candidates[0] ?? null };
}

function unmatchedSelector(selector: string, reason?: string): string {
    return reason ? `${selector} (${reason})` : selector;
}
