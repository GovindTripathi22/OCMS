import type { SchemaField } from "@/types/schema";
import {
    findJSXElements,
    parseTSX,
    readJSXElementDetails,
} from "@/lib/jsx-ast-helpers";

export function syncSchemaFromSource(sourceCode: string, currentSchema: SchemaField[]): SchemaField[] {
    const ast = parseTSX(sourceCode);

    return currentSchema.map((field) => {
        if (!field.selector) return field;

        const target = findJSXElements(ast, field.selector)[0];
        if (!target) return field;

        const details = readJSXElementDetails(target, field.type);
        if (!details.value) return field;

        return {
            ...field,
            value: details.value,
            originalHtmlTag: details.originalHtmlTag || field.originalHtmlTag,
            alt: details.alt ?? field.alt,
            objectFit: details.objectFit ?? field.objectFit,
            borderRadius: details.borderRadius ?? field.borderRadius,
        };
    });
}
