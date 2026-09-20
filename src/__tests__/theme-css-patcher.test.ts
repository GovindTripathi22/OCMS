import { patchCssWithThemeColors } from "@/lib/theme-css-patcher";

describe("patchCssWithThemeColors", () => {
    const testColors = ["#ffffff", "#2563eb", "#38bdf8", "#f59e0b", "#0f172a"];

    it("prepends a :root block when none exists", () => {
        const css = "body { margin: 0; padding: 0; }";
        const patched = patchCssWithThemeColors(css, testColors);

        expect(patched).toContain(":root {");
        expect(patched).toContain("--theme-background: #ffffff;");
        expect(patched).toContain("--theme-primary: #2563eb;");
        expect(patched).toContain("--theme-secondary: #38bdf8;");
        expect(patched).toContain("--theme-accent: #f59e0b;");
        expect(patched).toContain("--theme-text: #0f172a;");
        expect(patched).toContain("body { margin: 0; padding: 0; }");
    });

    it("updates existing theme variables in an existing :root block", () => {
        const existingCss = `
:root {
    --custom-font: 'Inter', sans-serif;
    --theme-primary: #000000;
    --theme-background: #eeeeee;
}

h1 { color: var(--theme-primary); }
`;
        const patched = patchCssWithThemeColors(existingCss, testColors);

        expect(patched).toContain("--custom-font: 'Inter', sans-serif;");
        expect(patched).toContain("--theme-background: #ffffff;");
        expect(patched).toContain("--theme-primary: #2563eb;");
        expect(patched).not.toContain("--theme-primary: #000000;");
        expect(patched).not.toContain("--theme-background: #eeeeee;");
        expect(patched).toContain("h1 { color: var(--theme-primary); }");
    });

    it("preserves comments and other CSS blocks intact", () => {
        const cssWithComments = `
/* Global styles */
:root {
    --app-padding: 16px;
}

/* Header rule */
header {
    display: flex;
}
`;
        const patched = patchCssWithThemeColors(cssWithComments, testColors);

        expect(patched).toContain("/* Global styles */");
        expect(patched).toContain("/* Header rule */");
        expect(patched).toContain("--app-padding: 16px;");
        expect(patched).toContain("--theme-accent: #f59e0b;");
    });
});
