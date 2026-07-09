/**
 * Unit tests for schema merge logic used in the scan-page route.
 * Tests deduplication, path-based preservation, and merge correctness.
 */

// The schema merge logic is extracted here for testability.
// It mirrors the logic in /api/projects/[projectId]/scan-page/route.ts

interface SchemaField {
    id: string;
    type: string;
    selector?: string;
    label?: string;
    value?: string;
    path?: string;
}

/**
 * Merges new fields for a given path into an existing schema.
 * - Fields for OTHER paths are preserved as-is
 * - New fields for the CURRENT path replace old ones
 * - Deduplication: new fields whose selector matches a preserved field are skipped
 */
function mergeSchema(
    existingFields: SchemaField[],
    newFields: SchemaField[],
    targetPath: string
): SchemaField[] {
    // Normalize path
    const normalizePath = (p?: string) => p || "/";

    // Preserve fields for other paths
    const preservedFields = existingFields.filter(
        (f) => normalizePath(f.path) !== normalizePath(targetPath)
    );

    // Deduplicate: skip new fields whose selector already exists in preserved
    const preservedSelectors = new Set(
        preservedFields.map((f) => f.selector).filter(Boolean) as string[]
    );
    const deduplicatedNew = newFields.filter(
        (f) => !f.selector || !preservedSelectors.has(f.selector)
    );

    return [...preservedFields, ...deduplicatedNew];
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("mergeSchema", () => {
    const existingSchema: SchemaField[] = [
        { id: "home-title", type: "text", selector: "h1", path: "/" },
        { id: "home-image", type: "image", selector: "img.hero", path: "/" },
        { id: "about-title", type: "text", selector: "h2", path: "/about" },
    ];

    it("replaces fields for the current path with new ones", () => {
        const newFields: SchemaField[] = [
            { id: "home-title-v2", type: "text", selector: "h1.new", path: "/" },
        ];
        const result = mergeSchema(existingSchema, newFields, "/");
        // about field preserved, home fields replaced by new
        expect(result.find((f) => f.id === "about-title")).toBeDefined();
        expect(result.find((f) => f.id === "home-title")).toBeUndefined();
        expect(result.find((f) => f.id === "home-title-v2")).toBeDefined();
    });

    it("preserves fields for other paths unchanged", () => {
        const newFields: SchemaField[] = [
            { id: "home-new", type: "text", selector: "span.new", path: "/" },
        ];
        const result = mergeSchema(existingSchema, newFields, "/");
        const aboutField = result.find((f) => f.id === "about-title");
        expect(aboutField).toBeDefined();
        expect(aboutField?.path).toBe("/about");
    });

    it("deduplicates: skips new fields whose selector matches a preserved field", () => {
        const existingWithMultiplePaths: SchemaField[] = [
            { id: "home-h1", type: "text", selector: "h1", path: "/" },
            { id: "about-h1", type: "text", selector: "h1", path: "/about" }, // same selector, different path
        ];
        const newFields: SchemaField[] = [
            // h1 is already in /about (preserved path), should be skipped
            { id: "blog-h1", type: "text", selector: "h1", path: "/blog" },
        ];
        const result = mergeSchema(existingWithMultiplePaths, newFields, "/");
        // The /about h1 is preserved; the new /blog h1 is deduplicated because selector matches
        const blogH1 = result.find((f) => f.id === "blog-h1");
        expect(blogH1).toBeUndefined(); // deduplicated
    });

    it("returns new fields when existing schema is empty", () => {
        const newFields: SchemaField[] = [
            { id: "title", type: "text", selector: "h1", path: "/" },
        ];
        const result = mergeSchema([], newFields, "/");
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("title");
    });

    it("returns existing schema when new fields are empty", () => {
        const result = mergeSchema(existingSchema, [], "/");
        // Only /about field is preserved (/ fields are replaced by nothing)
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("about-title");
    });

    it("handles fields with no path (defaults to /)", () => {
        const existing: SchemaField[] = [
            { id: "no-path-field", type: "text", selector: "p" }, // no path
            { id: "about-field", type: "text", selector: "h2", path: "/about" },
        ];
        const newFields: SchemaField[] = [
            { id: "new-root-field", type: "text", selector: "span", path: "/" },
        ];
        // Field with no path is treated as "/" so it gets replaced
        const result = mergeSchema(existing, newFields, "/");
        expect(result.find((f) => f.id === "no-path-field")).toBeUndefined();
        expect(result.find((f) => f.id === "about-field")).toBeDefined();
        expect(result.find((f) => f.id === "new-root-field")).toBeDefined();
    });

    it("preserves all paths when scanning a deep route", () => {
        const existing: SchemaField[] = [
            { id: "home-a", type: "text", selector: "h1", path: "/" },
            { id: "blog-a", type: "text", selector: "h2", path: "/blog" },
            { id: "contact-a", type: "text", selector: "h3", path: "/contact" },
        ];
        const newFields: SchemaField[] = [
            { id: "blog-b", type: "text", selector: "h2.new", path: "/blog" },
        ];
        const result = mergeSchema(existing, newFields, "/blog");
        expect(result.find((f) => f.id === "home-a")).toBeDefined();
        expect(result.find((f) => f.id === "contact-a")).toBeDefined();
        expect(result.find((f) => f.id === "blog-a")).toBeUndefined(); // replaced
        expect(result.find((f) => f.id === "blog-b")).toBeDefined(); // new
    });
});
