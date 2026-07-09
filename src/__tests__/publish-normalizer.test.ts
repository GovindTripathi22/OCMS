/**
 * Unit tests for the publish change normalizer.
 * Verifies that raw changes from the client are sanitized properly.
 */

import { normalizeChanges, type SourceChange } from "@/lib/publish-change-normalizer";

describe("normalizeChanges", () => {
    it("returns empty array for empty input", () => {
        expect(normalizeChanges([])).toEqual([]);
    });

    it("normalizes a valid text change", () => {
        const changes: SourceChange[] = [
            { selector: "h1", type: "text", newValue: "Hello World" },
        ];
        const result = normalizeChanges(changes);
        expect(result).toHaveLength(1);
        expect(result[0].selector).toBe("h1");
        expect(result[0].type).toBe("text");
        expect(result[0].newValue).toBe("Hello World");
    });

    it("normalizes a valid image change", () => {
        const changes: SourceChange[] = [
            { selector: "img.hero", type: "image", newValue: "/new-image.jpg", alt: "New hero" },
        ];
        const result = normalizeChanges(changes);
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe("image");
        expect(result[0].alt).toBe("New hero");
    });

    it("maps 'list' type to 'text'", () => {
        const changes: SourceChange[] = [
            { selector: "ul.items", type: "list", newValue: "Item 1\nItem 2" },
        ];
        const result = normalizeChanges(changes);
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe("text"); // list maps to text
    });

    it("drops changes with missing selector", () => {
        const changes: SourceChange[] = [
            { type: "text", newValue: "No selector here" },
        ];
        const result = normalizeChanges(changes);
        expect(result).toHaveLength(0);
    });

    it("drops changes with non-string selector", () => {
        const changes: SourceChange[] = [
            { selector: 123 as unknown as string, type: "text", newValue: "value" },
        ];
        const result = normalizeChanges(changes);
        expect(result).toHaveLength(0);
    });

    it("drops changes with missing newValue", () => {
        const changes: SourceChange[] = [
            { selector: "h1", type: "text" },
        ];
        const result = normalizeChanges(changes);
        expect(result).toHaveLength(0);
    });

    it("drops changes with invalid type", () => {
        const changes: SourceChange[] = [
            { selector: "h1", type: "unknown-type", newValue: "value" },
        ];
        const result = normalizeChanges(changes);
        expect(result).toHaveLength(0);
    });

    it("includes oldValue when string", () => {
        const changes: SourceChange[] = [
            { selector: "h1", type: "text", newValue: "New", oldValue: "Old" },
        ];
        const result = normalizeChanges(changes);
        expect(result[0].oldValue).toBe("Old");
    });

    it("omits oldValue when not a string", () => {
        const changes: SourceChange[] = [
            { selector: "h1", type: "text", newValue: "New", oldValue: 42 as unknown as string },
        ];
        const result = normalizeChanges(changes);
        expect(result[0].oldValue).toBeUndefined();
    });

    it("normalizes multiple valid changes", () => {
        const changes: SourceChange[] = [
            { selector: "h1", type: "text", newValue: "Title" },
            { selector: "p.sub", type: "text", newValue: "Subtitle" },
            { selector: "img.logo", type: "image", newValue: "/logo.png" },
        ];
        const result = normalizeChanges(changes);
        expect(result).toHaveLength(3);
    });

    it("filters out invalid changes from a mixed batch", () => {
        const changes: SourceChange[] = [
            { selector: "h1", type: "text", newValue: "Good" },
            { selector: "bad-type", type: "unknown", newValue: "Bad" },
            { type: "text", newValue: "No selector" },
            { selector: "img.ok", type: "image", newValue: "/ok.jpg" },
        ];
        const result = normalizeChanges(changes);
        expect(result).toHaveLength(2);
        expect(result[0].selector).toBe("h1");
        expect(result[1].selector).toBe("img.ok");
    });
});
