import {
    toProxyUrl,
    rewriteCssUrls,
    filterScripts,
    stripEventHandlers,
    patchHtmlWithSchema,
    readBoundedBody,
} from "@/lib/proxy";

describe("Proxy Engine Modules", () => {
    describe("URL Resolver", () => {
        it("transforms relative URLs to proxied absolute URLs", () => {
            const result = toProxyUrl("/assets/logo.png", "https://example.com");
            expect(result).toBe("/api/proxy?url=https%3A%2F%2Fexample.com%2Fassets%2Flogo.png");
        });

        it("preserves hash, data, and blob URLs", () => {
            expect(toProxyUrl("#section", "https://example.com")).toBe("#section");
            expect(toProxyUrl("data:image/png;base64,...", "https://example.com")).toBe("data:image/png;base64,...");
            expect(toProxyUrl("blob:http://...", "https://example.com")).toBe("blob:http://...");
        });

        it("neutralizes javascript: URLs to #", () => {
            expect(toProxyUrl("javascript:alert(1)", "https://example.com")).toBe("#");
        });

        it("appends projectId, scriptMode, and nonce when provided", () => {
            const result = toProxyUrl("/style.css", "https://example.com", "proj-123", "dynamic", "nonce-xyz");
            expect(result).toContain("projectId=proj-123");
            expect(result).toContain("scriptMode=dynamic");
            expect(result).toContain("nonce=nonce-xyz");
        });

        it("rewrites css url() references", () => {
            const css = `body { background: url('/bg.jpg'); }`;
            const rewritten = rewriteCssUrls(css, "https://example.com");
            expect(rewritten).toContain("/api/proxy?url=https%3A%2F%2Fexample.com%2Fbg.jpg");
        });
    });

    describe("Script Sanitizer", () => {
        it("removes executable scripts in static mode", () => {
            const html = `<p>Test</p><script>evil()</script>`;
            expect(filterScripts(html, "static")).toBe("<p>Test</p>");
        });

        it("preserves ld+json structured data scripts in static mode", () => {
            const jsonScript = `<script type="application/ld+json">{"@context":"schema.org"}</script>`;
            const html = `<div>${jsonScript}</div><script>evil()</script>`;
            const filtered = filterScripts(html, "static");
            expect(filtered).toContain(jsonScript);
            expect(filtered).not.toContain("evil()");
        });

        it("preserves scripts in dynamic mode", () => {
            const html = `<script>app()</script>`;
            expect(filterScripts(html, "dynamic")).toBe(html);
        });

        it("strips event handlers", () => {
            const html = `<button onclick="doSomething()" onmouseover='hover()'>Click</button>`;
            const stripped = stripEventHandlers(html);
            expect(stripped).not.toContain("onclick");
            expect(stripped).not.toContain("onmouseover");
            expect(stripped).toContain("Click");
        });
    });

    describe("HTML Schema Patching", () => {
        it("patches text fields by selector", () => {
            const html = `<h1 class="hero-title">Old Title</h1>`;
            const patched = patchHtmlWithSchema(html, [
                {
                    id: "field-1",
                    type: "text",
                    label: "Title",
                    value: "New Title",
                    selector: ".hero-title",
                },
            ]);
            expect(patched).toContain("New Title");
            expect(patched).not.toContain("Old Title");
        });

        it("patches img src attributes by selector", () => {
            const html = `<img id="logo" src="/old.png" />`;
            const patched = patchHtmlWithSchema(html, [
                {
                    id: "field-2",
                    type: "image",
                    label: "Logo",
                    value: "/new.png",
                    selector: "#logo",
                },
            ]);
            expect(patched).toContain('src="/new.png"');
        });
    });

    describe("Bounded Body Reader", () => {
        it("reads response within limits", async () => {
            const res = new Response("Hello World");
            const result = await readBoundedBody(res, 100);
            expect(result.exceeded).toBe(false);
            expect(result.buffer?.toString("utf8")).toBe("Hello World");
        });

        it("aborts when payload exceeds maxBytes", async () => {
            const largeData = "A".repeat(500);
            const res = new Response(largeData);
            const result = await readBoundedBody(res, 100);
            expect(result.exceeded).toBe(true);
            expect(result.buffer).toBeNull();
        });
    });
});
