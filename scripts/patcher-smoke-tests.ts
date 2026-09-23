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

const jsxPartialReport = patchJSXWithReport(jsxFixture, [
    { type: "text", selector: "main > section.hero h1.title", oldValue: "Old Hero", newValue: "Partially Updated Hero" },
    { type: "text", selector: "section.hero h2.stale", oldValue: "Stale", newValue: "Should Not Apply" },
]);
assert.equal(jsxPartialReport.appliedCount, 1, "partial JSX batch should apply matching selectors");
assert.deepEqual(jsxPartialReport.matchedSelectors, ["main > section.hero h1.title"]);
assert.deepEqual(jsxPartialReport.unmatchedSelectors, ["section.hero h2.stale"]);
assert.match(jsxPartialReport.code, /Partially Updated Hero/);

const mappedListFixture = `
const cards = [
    { title: "First Card", description: "First description" },
    { title: "Second Card", description: "Second description" },
    { title: "Third Card", description: "Third description" },
];

export default function Cards() {
    return (
        <section className="cards">
            {cards.map((card) => (
                <article className="card" key={card.title}>
                    <h3>{card.title}</h3>
                    <p>{card.description}</p>
                </article>
            ))}
        </section>
    );
}
`;

const mappedListReport = patchJSXWithReport(mappedListFixture, [
    {
        type: "text",
        selector: "section.cards article.card:nth-of-type(2) h3",
        oldValue: "Second Card",
        newValue: "Updated Second Card",
    },
]);

assert.equal(mappedListReport.appliedCount, 1, "mapped JSX static array edit should apply once");
assert.deepEqual(mappedListReport.unmatchedSelectors, [], "mapped JSX static array edit should match");
assert.match(mappedListReport.code, /title:\s*"First Card"/);
assert.match(mappedListReport.code, /title:\s*"Updated Second Card"/);
assert.match(mappedListReport.code, /title:\s*"Third Card"/);
assert.doesNotMatch(mappedListReport.code, /<h3>\s*\{"Updated Second Card"\}\s*<\/h3>/);

const mappedAmbiguousReport = patchJSXWithReport(mappedListFixture, [
    {
        type: "text",
        selector: "section.cards article.card:nth-of-type(2) h3",
        newValue: "No Old Value",
    },
]);
assert.equal(mappedAmbiguousReport.appliedCount, 0);
assert.deepEqual(mappedAmbiguousReport.unmatchedSelectors, [
    "section.cards article.card:nth-of-type(2) h3 (ambiguous: element renders via .map() and no old value was provided)",
]);

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

// ─── Test data-ocms-field primary target selector ───
const ocmsBindingFixture = `
export default function Page() {
    return (
        <section>
            <h1 className="title" data-ocms-field="hero-heading">Original Heading</h1>
            <p data-ocms-field="hero-subheading">Original Subheading</p>
            <div className="title">Unrelated element with same class</div>
        </section>
    );
}
`;

const ocmsBindingReport = patchJSXWithReport(ocmsBindingFixture, [
    {
        type: "text",
        selector: ".title", // Ambiguous CSS class, but fieldId binds to hero-heading
        fieldId: "hero-heading",
        newValue: "Bound Heading Updated",
    },
    {
        type: "text",
        selector: '[data-ocms-field="hero-subheading"]',
        newValue: "Subheading via Attribute Selector",
    }
]);

assert.equal(ocmsBindingReport.appliedCount, 2, "data-ocms-field bound elements should be patched");
assert.match(ocmsBindingReport.code, /Bound Heading Updated/);
assert.match(ocmsBindingReport.code, /Subheading via Attribute Selector/);
assert.match(ocmsBindingReport.code, /Unrelated element with same class/, "unrelated element should remain untouched");

// ─── Test Rich Text Preservation (do NOT flatten <p>Hello <strong>world</strong></p>) ───
const richTextFixture = `
export default function RichPage() {
    return (
        <div>
            <p className="intro">Hello <strong>world</strong></p>
            <p className="outro">Visit our <em>awesome</em> <a href="/blog">community</a> today</p>
        </div>
    );
}
`;

const richTextReport = patchJSXWithReport(richTextFixture, [
    {
        type: "text",
        selector: "p.intro",
        oldValue: "Hello world",
        newValue: "Hello friends", // Plain text edit: should preserve <strong> wrapper!
    },
    {
        type: "text",
        selector: "p.outro",
        newValue: "Visit our <strong>stellar</strong> <a href=\"/blog\">community</a> today", // Rich markup edit
    }
]);

assert.equal(richTextReport.appliedCount, 2, "rich text elements should be patched");
assert.match(richTextReport.code, /Hello\s*<strong>friends<\/strong>/, "strong tag must be preserved when plain text is edited");
assert.doesNotMatch(richTextReport.code, /<p className="intro">\{"Hello friends"\}<\/p>/, "intro must not be flattened to string literal");
assert.match(richTextReport.code, /Visit our\s*<strong>stellar<\/strong>\s*<a href="\/blog">community<\/a>\s*today/, "rich HTML markup must be parsed as real JSX nodes");

// ─── Test JSX Patcher Safety against < delimiter syntax error ───
const jsxSpecialCharReport = patchJSXWithReport(jsxFixture, [
    { type: "text", selector: "h1.title", newValue: "price < $10" },
]);
assert.equal(jsxSpecialCharReport.appliedCount, 1, "text containing < must be patched");
assert.match(jsxSpecialCharReport.code, /price < \$10/, "code must contain escaped/safe price < $10");

// ─── Test JSX Alt Attribute Quote Escaping ───
const jsxAltQuoteReport = patchJSXWithReport(jsxFixture, [
    { type: "image", selector: "img.hero-img", newValue: "/new.png", alt: 'a "great" photo' },
]);
assert.equal(jsxAltQuoteReport.appliedCount, 1, "alt text containing quotes must be patched");
assert.match(jsxAltQuoteReport.code, /\\"great\\"/, "alt text quotes must be safely enclosed");

// ─── Test Live Expression / Code Injection Prevention ───
const jsxSecretReport = patchJSXWithReport(jsxFixture, [
    { type: "text", selector: "h1.title", newValue: "{process.env.SECRET_KEY}" },
]);
assert.equal(jsxSecretReport.appliedCount, 1);
assert.match(jsxSecretReport.code, /"\{process\.env\.SECRET_KEY\}"/, "secrets must be string literals, not raw expressions");

const jsxDangerousTagReport = patchJSXWithReport(jsxFixture, [
    { type: "text", selector: "h1.title", newValue: '<button onClick={() => alert("xss")}>Click</button>' },
]);
assert.equal(jsxDangerousTagReport.appliedCount, 1);
assert.doesNotMatch(jsxDangerousTagReport.code, /<h1[^>]*>\s*<button/, "dangerous tags must not be parsed into executable JSX child elements");
assert.match(jsxDangerousTagReport.code, /\{"<button onClick=/, "dangerous tags must be safely enclosed as string literals");

// ─── Test Full HTML Document DOCTYPE / html / head / body Preservation ───
const fullDocHtml = '<!DOCTYPE html><html lang="en"><head><title>Title</title></head><body><h1>Old</h1></body></html>';
const fullDocReport = patchHTMLWithReport(fullDocHtml, [
    { type: "text", selector: "h1", newValue: "New Headline" },
]);
assert.equal(fullDocReport.appliedCount, 1);
assert.match(fullDocReport.code, /<!DOCTYPE\s+html>/i, "DOCTYPE must be preserved");
assert.match(fullDocReport.code, /<html/i, "html tag must be preserved");
assert.match(fullDocReport.code, /<head>/i, "head tag must be preserved");
assert.match(fullDocReport.code, /<body/i, "body tag must be preserved");
assert.match(fullDocReport.code, /New Headline/);

console.log("patcher smoke tests passed");
