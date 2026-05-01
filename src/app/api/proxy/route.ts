import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get("url");

    if (!url) {
        return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    try {
        const response = await fetch(url);
        const html = await response.text();
        const baseUrl = new URL(url).origin;

        // Patch script: Override history.pushState/replaceState to prevent
        // SecurityError when the proxied site's JS tries to navigate with
        // its own origin while running inside our localhost iframe.
        const patchScript = `
<script>
(function() {
    try {
        Object.defineProperty(window.history, 'pushState', {
            value: function() {},
            writable: false,
            configurable: true
        });
        Object.defineProperty(window.history, 'replaceState', {
            value: function() {},
            writable: false,
            configurable: true
        });
    } catch(e) {}
})();
</script>`;

        // Replace relative asset paths with absolute paths
        let modifiedHtml = html.replace(/(src|href|srcset)="\//g, `$1="${baseUrl}/`);

        // Inject script right before closing body tag to avoid strict hydration mismatch
        modifiedHtml = modifiedHtml.replace(
            /<\/body>/i,
            `${patchScript}</body>`
        );

        return new NextResponse(modifiedHtml, {
            status: response.status,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Access-Control-Allow-Origin": "*",
                "Content-Security-Policy": "frame-ancestors *",
            },
        });
    } catch {
        return NextResponse.json(
            { error: "Failed to proxy the requested URL." },
            { status: 500 }
        );
    }
}
