import { runLocalStaticAudit } from "@/lib/static-performance-audit";

describe("runLocalStaticAudit", () => {
    it("returns perfect scores for compliant HTML", () => {
        const cleanHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Compliant Page Title for Audit Testing</title>
    <meta name="description" content="This is an accessible, well-formed test page with appropriate SEO description.">
    <script src="https://example.com/app.js" defer></script>
</head>
<body>
    <header>
        <nav>
            <a href="https://example.com/home">Home</a>
        </nav>
    </header>
    <main>
        <h1>Welcome to Compliant Site</h1>
        <p>A well-structured paragraph with informative content.</p>
        <img src="https://example.com/hero.jpg" alt="A hero demonstration image" width="800" height="600">
    </main>
</body>
</html>
`;
        const result = runLocalStaticAudit(cleanHtml);
        expect(result.auditType).toBe("LOCAL_STATIC_AUDIT");
        expect(result.scores.performance).toBe(100);
        expect(result.scores.accessibility).toBe(100);
        expect(result.scores.seo).toBe(100);
        expect(result.issues).toHaveLength(0);
        expect(result.passedChecks.length).toBeGreaterThan(4);
    });

    it("penalizes missing alt tags and missing dimensions on images", () => {
        const badImagesHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Image Test Page With Long Enough Title</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Test description for image testing">
</head>
<body>
    <img src="/photo1.jpg">
    <img src="/photo2.jpg" alt="">
</body>
</html>
`;
        const result = runLocalStaticAudit(badImagesHtml);
        expect(result.scores.accessibility).toBeLessThan(100);
        expect(result.scores.performance).toBeLessThan(100);

        const a11yIssue = result.issues.find((i) => i.title === "Images missing alt text");
        expect(a11yIssue).toBeDefined();

        const perfIssue = result.issues.find((i) => i.title === "Images missing explicit dimensions");
        expect(perfIssue).toBeDefined();
    });

    it("penalizes render-blocking synchronous scripts", () => {
        const blockingScriptsHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Scripts Test Page Long Enough</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Test description">
    <script src="/blocking1.js"></script>
    <script src="/blocking2.js"></script>
</head>
<body>
    <h1>Scripts Test</h1>
</body>
</html>
`;
        const result = runLocalStaticAudit(blockingScriptsHtml);
        expect(result.scores.performance).toBeLessThan(100);
        const scriptIssue = result.issues.find((i) => i.title === "Render-blocking scripts detected");
        expect(scriptIssue).toBeDefined();
    });

    it("penalizes missing SEO meta description, missing title, and missing viewport", () => {
        const noSeoHtml = `
<!DOCTYPE html>
<html>
<body>
    <p>No title, viewport, or meta description</p>
</body>
</html>
`;
        const result = runLocalStaticAudit(noSeoHtml);
        expect(result.scores.seo).toBeLessThan(80);
        expect(result.issues.some((i) => i.title === "Missing <title> tag")).toBe(true);
        expect(result.issues.some((i) => i.title === "Missing meta description")).toBe(true);
        expect(result.issues.some((i) => i.title === "Missing mobile viewport meta tag")).toBe(true);
    });

    it("penalizes empty links and insecure javascript: links", () => {
        const badLinksHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Links Test Page With Long Enough Title</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Links test description">
</head>
<body>
    <a href="/somewhere"></a>
    <a href="javascript:void(0)">Click me</a>
</body>
</html>
`;
        const result = runLocalStaticAudit(badLinksHtml);
        expect(result.scores.accessibility).toBeLessThan(100);
        expect(result.issues.some((i) => i.title === "Empty link labels")).toBe(true);
        expect(result.issues.some((i) => i.title === "Insecure javascript: links")).toBe(true);
    });
});
