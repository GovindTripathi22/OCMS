import { parse } from "@babel/parser";
import traverse, { type NodePath } from "@babel/traverse";
import * as t from "@babel/types";

export type JSXFieldType = "text" | "image" | "link" | "3d-model" | "list" | string;

export interface JSXWriteOptions {
    alt?: string;
    objectFit?: string;
    borderRadius?: string;
}

interface SelectorPart {
    tag?: string;
    id?: string;
    classes: string[];
    nthOfType?: number;
    combinator?: "child" | "descendant";
}

export function parseTSX(sourceCode: string): t.File {
    return parse(sourceCode, {
        sourceType: "module",
        plugins: ["jsx", "typescript"],
    });
}

export function findJSXElements(ast: t.File, selector: string): NodePath<t.JSXElement>[] {
    const parts = parseSelector(selector);
    if (!parts.length) return [];

    const matches: NodePath<t.JSXElement>[] = [];
    traverse(ast, {
        JSXElement(path) {
            if (matchesSelector(path, parts, parts.length - 1)) {
                matches.push(path);
            }
        },
    });

    return matches;
}

export function readJSXElementValue(path: NodePath<t.JSXElement>, type: JSXFieldType): string | null {
    const fieldType = type.toLowerCase();

    if (fieldType === "image") {
        const imageNode = findFirstElementNode(path.node, isImageElement);
        if (imageNode) return readStaticJSXAttribute(imageNode, "src");

        const backgroundImage = readStaticStyleProperty(path.node, "backgroundImage");
        return backgroundImage ? extractCssUrl(backgroundImage) || backgroundImage : null;
    }

    if (fieldType === "link") {
        const linkNode = findFirstElementNode(path.node, isAnchorElement);
        return linkNode ? readStaticJSXAttribute(linkNode, "href") : readStaticJSXAttribute(path.node, "href");
    }

    if (fieldType === "3d-model") {
        const modelNode = findFirstElementNode(path.node, isModelElement);
        return modelNode ? readStaticJSXAttribute(modelNode, "src") : readStaticJSXAttribute(path.node, "src");
    }

    return normalizeText(readTextContent(path.node));
}

export function readJSXElementDetails(path: NodePath<t.JSXElement>, type: JSXFieldType) {
    const fieldType = type.toLowerCase();
    const contentNode =
        fieldType === "image"
            ? findFirstElementNode(path.node, isImageElement) ?? path.node
            : fieldType === "link"
              ? findFirstElementNode(path.node, isAnchorElement) ?? path.node
              : fieldType === "3d-model"
                ? findFirstElementNode(path.node, isModelElement) ?? path.node
                : path.node;

    return {
        value: readJSXElementValue(path, type),
        originalHtmlTag: getJSXTagName(contentNode),
        alt: readStaticJSXAttribute(contentNode, "alt") ?? undefined,
        objectFit: readStaticStyleProperty(contentNode, "objectFit") ?? undefined,
        borderRadius: readStaticStyleProperty(contentNode, "borderRadius") ?? undefined,
    };
}

export function writeJSXElementValue(
    path: NodePath<t.JSXElement>,
    type: JSXFieldType,
    newValue: string,
    options: JSXWriteOptions = {}
): void {
    const fieldType = type.toLowerCase();

    if (fieldType === "text" || fieldType === "list") {
        replaceElementText(path.node, newValue);
        return;
    }

    if (fieldType === "image") {
        const imageNode = findFirstElementNode(path.node, isImageElement);
        if (imageNode) {
            setJSXAttribute(imageNode.openingElement, "src", newValue);
            if (options.alt !== undefined) setJSXAttribute(imageNode.openingElement, "alt", options.alt);
            applyStyleOptions(imageNode, options);
            return;
        }

        mergeStyleProperties(path.node.openingElement, {
            backgroundImage: `url(${newValue})`,
            objectFit: options.objectFit,
            borderRadius: options.borderRadius,
        });
        if (options.alt !== undefined) setJSXAttribute(path.node.openingElement, "aria-label", options.alt);
        return;
    }

    if (fieldType === "link") {
        const linkNode = findFirstElementNode(path.node, isAnchorElement) ?? path.node;
        setJSXAttribute(linkNode.openingElement, "href", newValue);
        return;
    }

    if (fieldType === "3d-model") {
        const modelNode = findFirstElementNode(path.node, isModelElement) ?? path.node;
        setJSXAttribute(modelNode.openingElement, "src", newValue);
        if (options.alt !== undefined) setJSXAttribute(modelNode.openingElement, "alt", options.alt);
        applyStyleOptions(modelNode, options);
    }
}

export function readStaticJSXAttribute(node: t.JSXElement, name: string): string | null {
    const attribute = findJSXAttribute(node.openingElement, name);
    if (!attribute?.value) return null;
    return readStaticAttributeValue(attribute.value);
}

export function readStaticStyleProperty(node: t.JSXElement, propertyName: string): string | null {
    const style = findJSXAttribute(node.openingElement, "style");
    if (!style?.value) return null;

    if (t.isJSXExpressionContainer(style.value) && t.isObjectExpression(style.value.expression)) {
        for (const property of style.value.expression.properties) {
            if (!t.isObjectProperty(property)) continue;
            if (objectKeyName(property.key) !== propertyName) continue;
            return readStaticExpressionValue(property.value as t.Expression);
        }
    }

    if (t.isStringLiteral(style.value)) {
        return readCssDeclaration(style.value.value, propertyName);
    }

    return null;
}

export function getJSXTagName(node: t.JSXElement): string {
    const name = node.openingElement.name;
    if (t.isJSXIdentifier(name)) return name.name;
    if (t.isJSXNamespacedName(name)) return `${name.namespace.name}:${name.name.name}`;
    if (t.isJSXMemberExpression(name)) return getJSXMemberName(name);
    return "";
}

export function normalizeText(value: string): string {
    return value.split(/\s+/).filter(Boolean).join(" ").trim();
}

function parseSelector(selector: string): SelectorPart[] {
    const parts: SelectorPart[] = [];
    let buffer = "";
    let pendingCombinator: SelectorPart["combinator"];
    let bracketDepth = 0;
    let parenDepth = 0;
    let quote: string | null = null;

    const pushBuffer = () => {
        const raw = buffer.trim();
        if (!raw) return;
        parts.push(parseSimpleSelector(raw, parts.length === 0 ? undefined : pendingCombinator ?? "descendant"));
        buffer = "";
        pendingCombinator = undefined;
    };

    for (const char of selector) {
        if (quote) {
            buffer += char;
            if (char === quote) quote = null;
            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
            buffer += char;
            continue;
        }

        if (char === "[") bracketDepth++;
        if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
        if (char === "(") parenDepth++;
        if (char === ")") parenDepth = Math.max(0, parenDepth - 1);

        if (bracketDepth === 0 && parenDepth === 0 && char === ">") {
            pushBuffer();
            pendingCombinator = "child";
            continue;
        }

        if (bracketDepth === 0 && parenDepth === 0 && /\s/.test(char)) {
            if (buffer.trim()) {
                pushBuffer();
                pendingCombinator = pendingCombinator ?? "descendant";
            }
            continue;
        }

        buffer += char;
    }

    pushBuffer();
    return parts;
}

function parseSimpleSelector(raw: string, combinator?: SelectorPart["combinator"]): SelectorPart {
    const part: SelectorPart = { classes: [], combinator };
    let index = 0;

    const readIdentifier = () => {
        const start = index;
        while (index < raw.length && ![".", "#", "[", ":"].includes(raw[index])) index++;
        return raw.slice(start, index);
    };

    if (raw[index] && ![".", "#", "[", ":"].includes(raw[index])) {
        part.tag = readIdentifier().toLowerCase();
    }

    while (index < raw.length) {
        const char = raw[index];

        if (char === ".") {
            index++;
            const className = readIdentifier();
            if (className) part.classes.push(className);
            continue;
        }

        if (char === "#") {
            index++;
            part.id = readIdentifier();
            continue;
        }

        if (char === "[") {
            const end = findClosing(raw, index, "[", "]");
            if (end === -1) break;
            applyAttributeSelector(raw.slice(index + 1, end), part);
            index = end + 1;
            continue;
        }

        if (raw.startsWith(":nth-of-type(", index)) {
            const start = index + ":nth-of-type(".length;
            const end = raw.indexOf(")", start);
            if (end === -1) break;
            const nth = Number.parseInt(raw.slice(start, end).trim(), 10);
            if (Number.isFinite(nth)) part.nthOfType = nth;
            index = end + 1;
            continue;
        }

        index++;
    }

    return part;
}

function applyAttributeSelector(rawAttribute: string, part: SelectorPart): void {
    const operatorIndex = rawAttribute.includes("~=") ? rawAttribute.indexOf("~=") : rawAttribute.indexOf("=");
    if (operatorIndex === -1) return;

    const attrName = rawAttribute.slice(0, operatorIndex).trim();
    const rawValue = rawAttribute.slice(operatorIndex + (rawAttribute.includes("~=") ? 2 : 1)).trim();
    const value = stripQuotes(rawValue);

    if (attrName === "id") {
        part.id = value;
        return;
    }

    if (attrName === "class" || attrName === "className") {
        part.classes.push(...value.split(/\s+/).filter(Boolean));
    }
}

function matchesSelector(path: NodePath<t.JSXElement>, parts: SelectorPart[], partIndex: number): boolean {
    if (partIndex < 0) return true;
    const part = parts[partIndex];
    if (!matchesSimpleSelector(path, part)) return false;
    if (partIndex === 0) return true;

    const previousPartIndex = partIndex - 1;
    const combinator = part.combinator ?? "descendant";

    if (combinator === "child") {
        const parent = parentJSXElementPath(path);
        return parent ? matchesSelector(parent, parts, previousPartIndex) : false;
    }

    let current = parentJSXElementPath(path);
    while (current) {
        if (matchesSelector(current, parts, previousPartIndex)) return true;
        current = parentJSXElementPath(current);
    }

    return false;
}

function matchesSimpleSelector(path: NodePath<t.JSXElement>, part: SelectorPart): boolean {
    const tagName = getJSXTagName(path.node);
    if (part.tag && tagName.toLowerCase() !== part.tag) return false;

    if (part.id && readStaticJSXAttribute(path.node, "id") !== part.id) return false;

    if (part.classes.length) {
        const className = readStaticJSXAttribute(path.node, "className") ?? readStaticJSXAttribute(path.node, "class") ?? "";
        const classSet = new Set(className.split(/\s+/).filter(Boolean));
        if (part.classes.some((classNamePart) => !classSet.has(classNamePart))) return false;
    }

    if (part.nthOfType !== undefined && nthOfType(path) !== part.nthOfType) return false;

    return true;
}

function parentJSXElementPath(path: NodePath<t.JSXElement>): NodePath<t.JSXElement> | null {
    let parent: NodePath | null = path.parentPath;
    while (parent) {
        if (parent.isJSXElement()) return parent as NodePath<t.JSXElement>;
        if (parent.isProgram() || parent.isFile()) return null;
        parent = parent.parentPath;
    }
    return null;
}

function nthOfType(path: NodePath<t.JSXElement>): number {
    const parent = parentJSXElementPath(path);
    if (!parent) return 1;

    const tagName = getJSXTagName(path.node);
    let index = 0;
    for (const child of parent.node.children) {
        if (!t.isJSXElement(child)) continue;
        if (getJSXTagName(child) !== tagName) continue;
        index++;
        if (child === path.node) return index;
    }

    return -1;
}

function findJSXAttribute(openingElement: t.JSXOpeningElement, name: string): t.JSXAttribute | null {
    for (const attribute of openingElement.attributes) {
        if (!t.isJSXAttribute(attribute)) continue;
        if (t.isJSXIdentifier(attribute.name) && attribute.name.name === name) return attribute;
    }

    return null;
}

function setJSXAttribute(openingElement: t.JSXOpeningElement, name: string, value: string | number): void {
    const existing = findJSXAttribute(openingElement, name);
    const nextValue =
        typeof value === "number"
            ? t.jsxExpressionContainer(t.numericLiteral(value))
            : t.stringLiteral(value);

    if (existing) {
        existing.value = nextValue;
        return;
    }

    openingElement.attributes.push(t.jsxAttribute(t.jsxIdentifier(name), nextValue));
}

function readStaticAttributeValue(value: t.JSXAttribute["value"]): string | null {
    if (!value) return null;
    if (t.isStringLiteral(value)) return value.value;
    if (!t.isJSXExpressionContainer(value)) return null;
    return readStaticExpressionValue(value.expression);
}

function readStaticExpressionValue(expression: t.Expression | t.JSXEmptyExpression): string | null {
    if (t.isStringLiteral(expression)) return expression.value;
    if (t.isNumericLiteral(expression)) return String(expression.value);
    if (t.isBooleanLiteral(expression)) return String(expression.value);
    if (t.isTemplateLiteral(expression) && expression.expressions.length === 0) {
        return expression.quasis[0]?.value.cooked ?? expression.quasis[0]?.value.raw ?? null;
    }
    return null;
}

function readTextContent(node: t.JSXElement | t.JSXFragment): string {
    let value = "";

    for (const child of node.children) {
        if (t.isJSXText(child)) {
            value += child.value;
        } else if (t.isJSXExpressionContainer(child)) {
            const staticValue = readStaticExpressionValue(child.expression);
            if (staticValue !== null) value += staticValue;
        } else if (t.isJSXElement(child) || t.isJSXFragment(child)) {
            value += readTextContent(child);
        }
    }

    return value;
}

function replaceElementText(node: t.JSXElement, newValue: string): void {
    node.openingElement.selfClosing = false;
    if (!node.closingElement) {
        node.closingElement = t.jsxClosingElement(t.cloneNode(node.openingElement.name));
    }
    node.children = [t.jsxExpressionContainer(t.stringLiteral(newValue))];
}

function findFirstElementNode(
    node: t.JSXElement,
    predicate: (node: t.JSXElement) => boolean
): t.JSXElement | null {
    if (predicate(node)) return node;

    for (const child of node.children) {
        if (t.isJSXElement(child)) {
            const match = findFirstElementNode(child, predicate);
            if (match) return match;
        }
    }

    return null;
}

function isImageElement(node: t.JSXElement): boolean {
    const tagName = getJSXTagName(node).toLowerCase();
    return tagName === "img" || tagName === "image" || tagName === "nextimage" || tagName.endsWith(".image");
}

function isAnchorElement(node: t.JSXElement): boolean {
    return getJSXTagName(node).toLowerCase() === "a";
}

function isModelElement(node: t.JSXElement): boolean {
    const tagName = getJSXTagName(node).toLowerCase();
    return tagName === "model-viewer" || tagName === "modelviewer" || tagName.endsWith(".modelviewer");
}

function applyStyleOptions(node: t.JSXElement, options: JSXWriteOptions): void {
    mergeStyleProperties(node.openingElement, {
        objectFit: options.objectFit,
        borderRadius: options.borderRadius,
    });
}

function mergeStyleProperties(openingElement: t.JSXOpeningElement, styles: Record<string, string | undefined>): void {
    const entries = Object.entries(styles).filter((entry): entry is [string, string] => entry[1] !== undefined);
    if (!entries.length) return;

    let style = findJSXAttribute(openingElement, "style");
    if (!style) {
        style = t.jsxAttribute(t.jsxIdentifier("style"), t.jsxExpressionContainer(t.objectExpression([])));
        openingElement.attributes.push(style);
    }

    let objectExpression: t.ObjectExpression;
    if (t.isJSXExpressionContainer(style.value) && t.isObjectExpression(style.value.expression)) {
        objectExpression = style.value.expression;
    } else {
        objectExpression = t.objectExpression([]);
        style.value = t.jsxExpressionContainer(objectExpression);
    }

    const incomingKeys = new Set(entries.map(([key]) => key));
    objectExpression.properties = objectExpression.properties.filter((property) => {
        if (!t.isObjectProperty(property)) return true;
        const key = objectKeyName(property.key);
        return !key || !incomingKeys.has(key);
    });

    objectExpression.properties.push(
        ...entries.map(([key, value]) => t.objectProperty(t.identifier(key), t.stringLiteral(value)))
    );
}

function objectKeyName(key: t.ObjectProperty["key"]): string | null {
    if (t.isIdentifier(key)) return key.name;
    if (t.isStringLiteral(key)) return key.value;
    if (t.isNumericLiteral(key)) return String(key.value);
    return null;
}

function readCssDeclaration(styleValue: string, propertyName: string): string | null {
    for (const declaration of styleValue.split(";")) {
        const colonIndex = declaration.indexOf(":");
        if (colonIndex === -1) continue;
        const name = declaration.slice(0, colonIndex).trim();
        if (cssPropertyToCamelCase(name) !== propertyName) continue;
        return declaration.slice(colonIndex + 1).trim() || null;
    }
    return null;
}

function cssPropertyToCamelCase(propertyName: string): string {
    const parts = propertyName.split("-").filter(Boolean);
    return parts
        .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
        .join("");
}

function extractCssUrl(value: string): string | null {
    const start = value.indexOf("url(");
    if (start === -1) return null;
    const contentStart = start + "url(".length;
    const contentEnd = value.indexOf(")", contentStart);
    if (contentEnd === -1) return null;
    return stripQuotes(value.slice(contentStart, contentEnd).trim());
}

function getJSXMemberName(name: t.JSXMemberExpression): string {
    const object = t.isJSXMemberExpression(name.object) ? getJSXMemberName(name.object) : name.object.name;
    return `${object}.${name.property.name}`;
}

function stripQuotes(value: string): string {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' || first === "'") && first === last) return value.slice(1, -1);
    return value;
}

function findClosing(value: string, start: number, open: string, close: string): number {
    let depth = 0;
    let quote: string | null = null;
    for (let index = start; index < value.length; index++) {
        const char = value[index];
        if (quote) {
            if (char === quote) quote = null;
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }
        if (char === open) depth++;
        if (char === close) {
            depth--;
            if (depth === 0) return index;
        }
    }
    return -1;
}
