import assert from "node:assert/strict";
import fs from "node:fs";
import { patchJSXWithReport, type ASTChange } from "../src/lib/ast-patcher";
import { patchHTMLWithReport } from "../src/lib/html-patcher";
import { normalizeChanges } from "../src/lib/publish-change-normalizer";

const jsxFixture = `
export default function Page() {
    return (
        <main>
            <section className="hero" id="top">
                <h1 className="title">Old Hero</h1>
                <p>First paragraph</p>
                <p>Second paragraph</p>
                <img className="hero-img" src="/old.png" alt="Old alt" style={{ objectFit: "cover" }} />
                <a className="cta" href="/old-link">Go</a>
                <div className="card" style={{ backgroundImage: "url(/old-bg.png)" }}>Card copy</div>
                <model-viewer className="product" src="/old-model.glb" />
            </section>
        </main>
    );
}
`;

const jsxChanges: ASTChange[] = [
    { type: "text", selector: "main > section.hero h1.title", oldValue: "Old Hero", newValue: "New Hero" },
    { type: "text", selector: "section.hero p:nth-of-type(2)", oldValue: "Second paragraph", newValue: "Updated second paragraph" },
    {
        type: "image",
        selector: "section.hero img.hero-img",
        oldValue: "/old.png",
        newValue: "/new.png",
        alt: "New alt",
        objectFit: "contain",
        borderRadius: "12px",
    },
    { type: "link", selector: "section.hero a.cta", oldValue: "/old-link", newValue: "/new-link" },
    { type: "image", selector: "section.hero div.card", oldValue: "/old-bg.png", newValue: "/new-bg.png" },
    { type: "3d-model", selector: "model-viewer.product", oldValue: "/old-model.glb", newValue: "/new-model.glb" },
];

const jsxReport = patchJSXWithReport(jsxFixture, jsxChanges);
assert.equal(jsxReport.appliedCount, jsxChanges.length, "all JSX changes should match");
assert.deepEqual(jsxReport.unmatchedSelectors, [], "JSX selectors should all match");
assert.match(jsxReport.code, /New Hero/);
assert.match(jsxReport.code, /Updated second paragraph/);
assert.match(jsxReport.code, /src="\/new\.png"/);
assert.match(jsxReport.code, /alt="New alt"/);
assert.match(jsxReport.code, /objectFit:\s*"contain"/);
assert.match(jsxReport.code, /borderRadius:\s*"12px"/);
assert.match(jsxReport.code, /href="\/new-link"/);
assert.match(jsxReport.code, /backgroundImage:\s*"url\(\/new-bg\.png\)"/);
assert.match(jsxReport.code, /src="\/new-model\.glb"/);

const jsxMissReport = patchJSXWithReport(jsxFixture, [
    { type: "text", selector: "section.hero h2.missing", oldValue: "Missing", newValue: "New" },
]);
assert.equal(jsxMissReport.appliedCount, 0);
assert.deepEqual(jsxMissReport.unmatchedSelectors, ["section.hero h2.missing"]);

const htmlFixture = `
<header class="hero">
    <h1 id="hero-title">Old Hero</h1>
    <p>First paragraph</p>
    <p>Second paragraph</p>
    <img class="hero-img" src="/old.png" alt="Old alt">
    <a class="cta" href="/old-link">Go</a>
    <div class="card" style="background-image: url('/old-bg.png')">Card copy</div>
    <model-viewer class="product" src="/old-model.glb"></model-viewer>
</header>
`;

const htmlChanges: ASTChange[] = [
    { type: "text", selector: "header.hero > h1", oldValue: "Old Hero", newValue: "New Hero" },
    { type: "text", selector: "header.hero p:nth-of-type(2)", oldValue: "Second paragraph", newValue: "Updated second paragraph" },
    {
        type: "image",
        selector: "img.hero-img",
        oldValue: "/old.png",
        newValue: "/new.png",
        alt: "New alt",
        objectFit: "contain",
        borderRadius: "12px",
    },
    { type: "link", selector: "a.cta", oldValue: "/old-link", newValue: "/new-link" },
    { type: "image", selector: "div.card", oldValue: "/old-bg.png", newValue: "/new-bg.png" },
    { type: "3d-model", selector: "model-viewer.product", oldValue: "/old-model.glb", newValue: "/new-model.glb" },
];

const htmlReport = patchHTMLWithReport(htmlFixture, htmlChanges);
assert.equal(htmlReport.appliedCount, htmlChanges.length, "all HTML changes should match");
assert.deepEqual(htmlReport.unmatchedSelectors, [], "HTML selectors should all match");
assert.match(htmlReport.code, /New Hero/);
assert.match(htmlReport.code, /Updated second paragraph/);
assert.match(htmlReport.code, /src="\/new\.png"/);
assert.match(htmlReport.code, /alt="New alt"/);
assert.match(htmlReport.code, /object-fit: contain/);
assert.match(htmlReport.code, /border-radius: 12px/);
assert.match(htmlReport.code, /href="\/new-link"/);
assert.match(htmlReport.code, /background-image: url\(\/new-bg\.png\)/);
assert.match(htmlReport.code, /src="\/new-model\.glb"/);

const normalized = normalizeChanges([
    { type: "list", selector: "ul > li:nth-of-type(1)", newValue: "List item" },
    { type: "image", selector: "img.logo", newValue: "/logo.png", alt: "Logo", objectFit: 42 },
    { type: "unknown", selector: ".ignored", newValue: "Ignored" },
    { type: "text", selector: ".ignored-missing-value" },
]);

assert.deepEqual(normalized, [
    { type: "text", selector: "ul > li:nth-of-type(1)", newValue: "List item" },
    { type: "image", selector: "img.logo", newValue: "/logo.png", alt: "Logo" },
]);

const publicTarget = fs.readFileSync("public/test-target.html", "utf8");
const publicReport = patchHTMLWithReport(publicTarget, [
    {
        type: "text",
        selector: "#hero-title",
        oldValue: "Welcome to Ghost Testing",
        newValue: "Welcome to Hardened Patching",
    },
    {
        type: "link",
        selector: "#cta-link",
        oldValue: "#",
        newValue: "/start",
    },
]);

assert.equal(publicReport.appliedCount, 2, "public/test-target.html fixture should be patchable without mutation");
assert.match(publicReport.code, /Welcome to Hardened Patching/);
assert.match(publicReport.code, /href="\/start"/);

console.log("patcher smoke tests passed");
