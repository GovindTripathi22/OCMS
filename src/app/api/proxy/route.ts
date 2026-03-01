import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get("url");

    if (!url) {
        return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    try {
        const response = await fetch(url);
        const html = await response.text();

        // 1. Determine the base URL so relative assets (images, css, js) don't break
        const baseUrl = new URL(url).origin;

        // 2. Inject a <base> tag right after <head> to fix all relative paths
        const modifiedHtml = html.replace(
            /<head[^>]*>/i,
            `$&<base href="${baseUrl}/">`
        );

        // 3. Return the HTML, effectively stripping the original server's X-Frame-Options
        // and Content-Security-Policy headers which block iframes.
        return new NextResponse(modifiedHtml, {
            status: response.status,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Access-Control-Allow-Origin": "*", // Allow our workspace to interact with it
            },
        });
    } catch {
        return NextResponse.json(
            { error: "Failed to proxy the requested URL." },
            { status: 500 }
        );
    }
}
