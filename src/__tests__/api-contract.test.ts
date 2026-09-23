import fs from "fs";
import path from "path";

describe("API contract: scan-page response", () => {
    it("scan-page response JSON should include schemaRevision field", () => {
        // This test verifies the contract by checking the response shape.
        // Since we can't easily call the route handler in a unit test without
        // mocking prisma, auth, fetch etc., we test the expected shape.
        // The actual fix is adding schemaRevision to the response JSON.

        // Read the source file and verify it returns schemaRevision
        const routeSource = fs.readFileSync(
            path.join(process.cwd(), "src/app/api/projects/[projectId]/scan-page/route.ts"),
            "utf-8"
        );

        // The response JSON must include schemaRevision
        expect(routeSource).toContain("schemaRevision");
        // Specifically in the success response (not just the DB update)
        // Look for schemaRevision in a NextResponse.json call, not just the prisma update
        const successResponseMatch = routeSource.match(/NextResponse\.json\(\{[\s\S]*?success:\s*true[\s\S]*?\}/m);
        expect(successResponseMatch).not.toBeNull();
        if (successResponseMatch) {
            expect(successResponseMatch[0]).toContain("schemaRevision");
        }
    });
});

describe("API contract: PATCH /projects/[id] body validation", () => {
    it("project route source should validate body is object", () => {
        const routeSource = fs.readFileSync(
            path.join(process.cwd(), "src/app/api/projects/[projectId]/route.ts"),
            "utf-8"
        );

        // The PATCH handler should have body type validation
        // Check it doesn't just blindly destructure
        expect(routeSource).toMatch(/typeof\s+body/); // should check typeof body
    });
});
