import { parse } from "@babel/parser";
import traverse, { type NodePath } from "@babel/traverse";
import * as t from "@babel/types";

export type JSXFieldType = "text" | "image" | "link" | "3d-model" | "list" | string;

export interface JSXWriteOptions {
    alt?: string;
    objectFit?: string;
    borderRadius?: string;
}

export interface AttributeSelector {
    name: string;
    value?: string;
    operator?: string;
}

interface SelectorPart {
    tag?: string;
    id?: string;
    classes: string[];
    attributes: AttributeSelector[];
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

export interface MappedExpressionWriteResult {
    applied: boolean;
    reason?: string;
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

export function isInsideMappedExpression(path: NodePath<t.JSXElement>): boolean {
    return getMappedExpressionContext(path) !== null;
}

export function writeStaticMappedExpressionValue(
    path: NodePath<t.JSXElement>,
    type: JSXFieldType,
    newValue: string,
    oldValue?: string
): MappedExpressionWriteResult {
    const context = getMappedExpressionContext(path);
    if (!context) return { applied: false };

    if (!oldValue) {
        return {
            applied: false,
            reason: "ambiguous: element renders via .map() and no old value was provided",
        };
    }

    const propertyName = findMappedValueProperty(path.node, type, context.itemName);
    if (!propertyName) {
        return {
            applied: false,
            reason: "ambiguous: element renders via .map()",
        };
    }

    const arrayExpression = resolveStaticArrayExpression(context.sourcePath);
    if (!arrayExpression) {
        return {
            applied: false,
            reason: "ambiguous: element renders via .map()",
        };
    }

    const normalizedOld = normalizeText(oldValue);
    const matches: t.ObjectProperty[] = [];

    for (const element of arrayExpression.node.elements) {
        if (!t.isObjectExpression(element)) continue;
        const property = findObjectProperty(element, propertyName);
        if (!property) continue;
        const currentValue = readStaticExpressionValue(property.value as t.Expression);
        if (currentValue !== null && normalizeText(currentValue) === normalizedOld) {
            matches.push(property);
        }
    }

    if (matches.length === 0) {
        return {
            applied: false,
            reason: "mapped static array did not contain the old value",
        };
    }

    if (matches.length > 1) {
        return {
            applied: false,
            reason: "ambiguous: element renders via .map() and old value is not unique",
        };
    }

    matches[0].value = t.stringLiteral(newValue);
    return { applied: true };
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
    const part: SelectorPart = { classes: [], attributes: [], combinator };
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
    const trimmed = rawAttribute.trim();
    if (!trimmed) return;

    const match = trimmed.match(/^([a-zA-Z0-9_\-:]+)(?:([~|^$*]?=)(.*))?$/);
    if (!match) {
        part.attributes.push({ name: trimmed });
        return;
    }

    const attrName = match[1].trim();
    const operator = match[2];
    const rawValue = match[3];

    if (!operator || rawValue === undefined) {
        part.attributes.push({ name: attrName });
        return;
    }

    const value = stripQuotes(rawValue.trim());

    if (attrName === "id" && operator === "=") {
        part.id = value;
    } else if ((attrName === "class" || attrName === "className") && (operator === "=" || operator === "~=")) {
        part.classes.push(...value.split(/\s+/).filter(Boolean));
    }

    part.attributes.push({ name: attrName, value, operator });
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

    if (part.attributes.length) {
        for (const attr of part.attributes) {
            const actualValue = readStaticJSXAttribute(path.node, attr.name);
            if (actualValue === null) return false;
            if (attr.value !== undefined) {
                if (attr.operator === "=" && actualValue !== attr.value) return false;
                if (attr.operator === "~=" && !actualValue.split(/\s+/).includes(attr.value)) return false;
                if (attr.operator === "^=" && !actualValue.startsWith(attr.value)) return false;
                if (attr.operator === "$=" && !actualValue.endsWith(attr.value)) return false;
                if (attr.operator === "*=" && !actualValue.includes(attr.value)) return false;
            }
        }
    }

    if (part.nthOfType !== undefined && nthOfType(path) !== part.nthOfType && !isInsideMappedExpression(path)) return false;

    return true;
}

interface MappedExpressionContext {
    callPath: NodePath<t.CallExpression>;
    sourcePath: NodePath<t.Expression>;
    itemName: string;
}

function getMappedExpressionContext(path: NodePath<t.JSXElement>): MappedExpressionContext | null {
    let current: NodePath | null = path.parentPath;

    while (current) {
        if (current.isCallExpression() && isMapLikeCall(current.node)) {
            const callback = current.node.arguments[0];
            if (!t.isArrowFunctionExpression(callback) && !t.isFunctionExpression(callback)) return null;
            const firstParam = callback.params[0];
            if (!t.isIdentifier(firstParam)) return null;

            const calleeObject = current.get("callee");
            if (!calleeObject.isMemberExpression()) return null;
            const sourcePath = calleeObject.get("object");
            if (!sourcePath.isExpression()) return null;

            return {
                callPath: current as NodePath<t.CallExpression>,
                sourcePath: sourcePath as NodePath<t.Expression>,
                itemName: firstParam.name,
            };
        }

        if (current.isProgram() || current.isFile()) return null;
        current = current.parentPath;
    }

    return null;
}

function isMapLikeCall(node: t.CallExpression): boolean {
    if (!t.isMemberExpression(node.callee)) return false;
    const property = node.callee.property;
    const methodName = t.isIdentifier(property)
        ? property.name
        : t.isStringLiteral(property)
          ? property.value
          : "";
    return methodName === "map" || methodName === "flatMap";
}

function resolveStaticArrayExpression(path: NodePath<t.Expression>): NodePath<t.ArrayExpression> | null {
    if (path.isArrayExpression()) return path as NodePath<t.ArrayExpression>;

    if (path.isCallExpression() && t.isMemberExpression(path.node.callee)) {
        const property = path.node.callee.property;
        const methodName = t.isIdentifier(property)
            ? property.name
            : t.isStringLiteral(property)
              ? property.value
              : "";
        if (methodName === "filter") {
            const objectPath = path.get("callee").get("object");
            if (objectPath.isExpression()) {
                return resolveStaticArrayExpression(objectPath as NodePath<t.Expression>);
            }
        }
    }

    if (!path.isIdentifier()) return null;

    const binding = path.scope.getBinding(path.node.name);
    const bindingPath = binding?.path;
    if (!bindingPath?.isVariableDeclarator()) return null;

    const initPath = bindingPath.get("init");
    return initPath.isArrayExpression() ? (initPath as NodePath<t.ArrayExpression>) : null;
}

function findMappedValueProperty(node: t.JSXElement, type: JSXFieldType, itemName: string): string | null {
    const fieldType = type.toLowerCase();

    if (fieldType === "image") {
        const imageNode = findFirstElementNode(node, isImageElement) ?? node;
        return propertyNameFromJSXAttribute(imageNode, "src", itemName);
    }

    if (fieldType === "link") {
        const linkNode = findFirstElementNode(node, isAnchorElement) ?? node;
        return propertyNameFromJSXAttribute(linkNode, "href", itemName);
    }

    if (fieldType === "3d-model") {
        const modelNode = findFirstElementNode(node, isModelElement) ?? node;
        return propertyNameFromJSXAttribute(modelNode, "src", itemName);
    }

    return findMappedTextProperty(node, itemName);
}

function propertyNameFromJSXAttribute(node: t.JSXElement, attributeName: string, itemName: string): string | null {
    const attribute = findJSXAttribute(node.openingElement, attributeName);
    if (!attribute?.value || !t.isJSXExpressionContainer(attribute.value)) return null;
    return propertyNameFromMemberExpression(attribute.value.expression, itemName);
}

function findMappedTextProperty(node: t.JSXElement | t.JSXFragment, itemName: string): string | null {
    for (const child of node.children) {
        if (t.isJSXExpressionContainer(child)) {
            const propertyName = propertyNameFromMemberExpression(child.expression, itemName);
            if (propertyName) return propertyName;
        }
        if (t.isJSXElement(child) || t.isJSXFragment(child)) {
            const propertyName = findMappedTextProperty(child, itemName);
            if (propertyName) return propertyName;
        }
    }

    return null;
}

function propertyNameFromMemberExpression(expression: t.Expression | t.JSXEmptyExpression, itemName: string): string | null {
    if (!t.isMemberExpression(expression)) return null;
    if (!t.isIdentifier(expression.object) || expression.object.name !== itemName) return null;

    const property = expression.property;
    if (t.isIdentifier(property)) return property.name;
    if (t.isStringLiteral(property)) return property.value;
    return null;
}

function findObjectProperty(objectExpression: t.ObjectExpression, propertyName: string): t.ObjectProperty | null {
    for (const property of objectExpression.properties) {
        if (!t.isObjectProperty(property)) continue;
        if (objectKeyName(property.key) === propertyName) return property;
    }

    return null;
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

export function readStaticExpressionValue(expression: t.Expression | t.JSXEmptyExpression): string | null {
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

export function parseJSXFragmentOrChildren(markup: string): (t.JSXElement | t.JSXText | t.JSXExpressionContainer | t.JSXFragment)[] | null {
    try {
        const wrapped = `<root>${markup}</root>`;
        const ast = parseTSX(wrapped);
        let result: (t.JSXElement | t.JSXText | t.JSXExpressionContainer | t.JSXFragment)[] | null = null;
        traverse(ast, {
            JSXElement(path) {
                if (getJSXTagName(path.node) === "root" && !result) {
                    result = path.node.children.filter((c): c is t.JSXElement | t.JSXText | t.JSXExpressionContainer | t.JSXFragment => !t.isJSXSpreadChild(c));
                    path.stop();
                }
            },
        });
        return result;
    } catch {
        return null;
    }
}

function preserveRichTextChildren(
    children: (t.JSXElement | t.JSXText | t.JSXExpressionContainer | t.JSXFragment | t.JSXSpreadChild)[],
    newValue: string
): (t.JSXElement | t.JSXText | t.JSXExpressionContainer | t.JSXFragment | t.JSXSpreadChild)[] | null {
    const elementIndex = children.findIndex((c) => t.isJSXElement(c));
    if (elementIndex === -1) return null;

    const targetElement = children[elementIndex] as t.JSXElement;
    const clonedChildren = children.map((c) => t.cloneNode(c, true));
    const clonedElement = clonedChildren[elementIndex] as t.JSXElement;

    // Slices before and after
    const beforeText = children.slice(0, elementIndex).map((c) => {
        if (t.isJSXText(c)) return c.value;
        if (t.isJSXElement(c) || t.isJSXFragment(c)) return readTextContent(c);
        return "";
    }).join("");

    const afterText = children.slice(elementIndex + 1).map((c) => {
        if (t.isJSXText(c)) return c.value;
        if (t.isJSXElement(c) || t.isJSXFragment(c)) return readTextContent(c);
        return "";
    }).join("");

    const elementOldText = readTextContent(targetElement);

    // Case 1: newValue starts with beforeText
    if (beforeText && newValue.startsWith(beforeText)) {
        const remainder = newValue.slice(beforeText.length);
        if (afterText && remainder.endsWith(afterText)) {
            const inner = remainder.slice(0, remainder.length - afterText.length);
            replaceElementText(clonedElement, inner);
            return clonedChildren;
        } else if (!afterText) {
            replaceElementText(clonedElement, remainder);
            return clonedChildren;
        }
    }

    // Case 2: newValue ends with afterText
    if (afterText && newValue.endsWith(afterText)) {
        const remainder = newValue.slice(0, newValue.length - afterText.length);
        if (beforeText && remainder.startsWith(beforeText)) {
            const inner = remainder.slice(beforeText.length);
            replaceElementText(clonedElement, inner);
            return clonedChildren;
        } else if (!beforeText) {
            replaceElementText(clonedElement, remainder);
            return clonedChildren;
        }
    }

    // Case 3: elementOldText is still present in newValue
    if (elementOldText && newValue.includes(elementOldText)) {
        const idx = newValue.indexOf(elementOldText);
        const newBefore = newValue.slice(0, idx);
        const newAfter = newValue.slice(idx + elementOldText.length);

        const result: typeof children = [];
        if (newBefore) result.push(t.jsxText(newBefore));
        result.push(clonedElement);
        if (newAfter) result.push(t.jsxText(newAfter));
        return result;
    }

    // Case 4: General proportional preservation: keep formatting element around remaining words
    if (beforeText) {
        const words = newValue.split(/\s+/);
        const beforeWords = beforeText.trim().split(/\s+/);
        if (words.length > beforeWords.length) {
            const preservedBefore = words.slice(0, beforeWords.length).join(" ") + " ";
            const inner = words.slice(beforeWords.length).join(" ");
            const result: typeof children = [];
            result.push(t.jsxText(preservedBefore));
            replaceElementText(clonedElement, inner);
            result.push(clonedElement);
            return result;
        }
    }

    replaceElementText(clonedElement, newValue);
    return [clonedElement];
}

function replaceElementText(node: t.JSXElement, newValue: string): void {
    node.openingElement.selfClosing = false;
    if (!node.closingElement) {
        node.closingElement = t.jsxClosingElement(t.cloneNode(node.openingElement.name));
    }

    // 1. If newValue contains markup tags, parse into real JSX nodes
    if (/<[a-zA-Z][^>]*>/i.test(newValue)) {
        const parsed = parseJSXFragmentOrChildren(newValue);
        if (parsed && parsed.length > 0) {
            node.children = parsed;
            return;
        }
    }

    // 2. If node has child JSX elements, preserve rich formatting structure
    const hasChildElements = node.children.some((c) => t.isJSXElement(c));
    if (hasChildElements) {
        const preserved = preserveRichTextChildren(node.children, newValue);
        if (preserved && preserved.length > 0) {
            node.children = preserved;
            return;
        }
    }

    // 3. Fallback plain text replacement
    node.children = [
        !/[{}]/.test(newValue)
            ? t.jsxText(newValue)
            : t.jsxExpressionContainer(t.stringLiteral(newValue))
    ];
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
