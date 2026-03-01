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
    var origPush = history.pushState;
    var origReplace = history.replaceState;
    history.pushState = function() {
        try { return origPush.apply(this, arguments); } catch(e) {}
    };
    history.replaceState = function() {
        try { return origReplace.apply(this, arguments); } catch(e) {}
    };
})();
</script>`;

        // Inject <base> for relative asset loading + the history patch
        const modifiedHtml = html.replace(
            /<head[^>]*>/i,
            `$&<base href="${baseUrl}/">${patchScript}`
        );

        return new NextResponse(modifiedHtml, {
            status: response.status,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch {
        return NextResponse.json(
            { error: "Failed to proxy the requested URL." },
            { status: 500 }
        );
    }
}
