import {
    extractColorsFromHtmlAndCss,
    normalizeColorToHex,
    matchPalette,
} from "@/lib/color-extractor";

describe("Extract Colors Engine", () => {
    describe("normalizeColorToHex", () => {
        it("normalizes 6-digit hex", () => {
            expect(normalizeColorToHex("#aabbcc")).toBe("#AABBCC");
        });

        it("normalizes 3-digit hex", () => {
            expect(normalizeColorToHex("#abc")).toBe("#AABBCC");
        });

        it("normalizes rgb colors to hex", () => {
            expect(normalizeColorToHex("rgb(255, 0, 128)")).toBe("#FF0080");
        });

        it("returns null for invalid strings", () => {
            expect(normalizeColorToHex("not-a-color")).toBeNull();
        });
    });

    describe("extractColorsFromHtmlAndCss", () => {
        it("extracts CSS variables and hex colors from markup and CSS", () => {
            const sample = `
                <style>
                    :root {
                        --theme-primary: #123456;
                        --theme-bg: #abcdef;
                        --color-accent: rgb(255, 100, 50);
                    }
                    body {
                        background: #abcdef;
                        color: #112233;
                    }
                    .btn {
                        background: #445566;
                    }
                </style>
                <div style="color: #778899">Hello</div>
            `;

            const colors = extractColorsFromHtmlAndCss(sample);
            expect(colors.length).toBeGreaterThanOrEqual(5);
            expect(colors).toContain("#123456");
            expect(colors).toContain("#ABCDEF");
            expect(colors).toContain("#112233");
        });
    });

    describe("matchPalette", () => {
        it("matches curated palettes by keyword", () => {
            const luxury = matchPalette("A luxury gold watch brand");
            expect(luxury).toEqual(["#1A1A1A", "#C5A55A", "#2D2D2D", "#F5E6CC", "#FFFFFF"]);

            const eco = matchPalette("Nature and eco green lifestyle");
            expect(eco).toEqual(["#F0F4E8", "#2D6A4F", "#95D5B2", "#1B4332", "#2D3436"]);
        });

        it("generates deterministic harmony palette when no keywords match", () => {
            const p1 = matchPalette("random unmatched query string");
            const p2 = matchPalette("random unmatched query string");
            expect(p1).toEqual(p2);
            expect(p1.length).toBe(5);
        });
    });
});
