import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedUser } from "@/auth";
import { fetchWithValidatedSsrfUrl, validateUrlForSsrf } from "@/lib/ssrf";
import { withRateLimit } from "@/lib/ratelimit";
import { requireOwnedProject } from "@/lib/auth-guards";
import {
    SchemaField,
    ScriptMode,
    toProxyUrl,
    rewriteCssUrls,
    rewriteHtmlAssets,
    patchHtmlWithSchema,
    readBoundedBody,
    corsHeaders,
    createPatchScript,
    MAX_HTML_BYTES,
    MAX_CSS_BYTES,
    MAX_ASSET_BYTES,
} from "@/lib/proxy";

export async function GET(req: NextRequest) {
    const rateLimited = await withRateLimit("proxy", req, { limit: 120, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const userId = await getAuthorizedUser();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let url = "";
    const rawUrl = req.url;
    const urlParamIndex = rawUrl.indexOf("?url=");
    if (urlParamIndex !== -1) {
        let rawParam = rawUrl.substring(urlParamIndex + 5);
        const controlParamIndex = ["&projectId=", "&scriptMode=", "&nonce="]
            .map((param) => rawParam.indexOf(param))
            .filter((index) => index !== -1)
            .sort((a, b) => a - b)[0];
        if (controlParamIndex !== undefined) {
            rawParam = rawParam.substring(0, controlParamIndex);
        }
        url = decodeURIComponent(rawParam);
    } else {
        url = req.nextUrl.searchParams.get("url") || "";
    }

    if (url) {
        url = url.replace(/&amp;/g, "&");
    }

    if (!url) {
        return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    // SSRF URL Security Validation via shared utility
    const validation = await validateUrlForSsrf(url);
    if (!validation.safe) {
        return NextResponse.json(
            { error: validation.error || "Forbidden URL" },
            { status: validation.error?.includes("blocked") ? 403 : 400 }
        );
    }

    const projectId = req.nextUrl.searchParams.get("projectId") || "";
    let ownedProject: import("@prisma/client").Project | null = null;
    if (projectId) {
        const ownership = await requireOwnedProject(projectId, userId);
        if (ownership.error) {
            return NextResponse.json({ error: ownership.error.message }, { status: ownership.error.status });
        }
        ownedProject = ownership.project;
    }

    const scriptMode: ScriptMode = req.nextUrl.searchParams.get("scriptMode") === "dynamic" ? "dynamic" : "static";
    const bridgeNonce = req.nextUrl.searchParams.get("nonce") || "";

    try {
        const response = await fetchWithValidatedSsrfUrl(url, validation, {
            redirect: "manual",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
        });

        const contentType = response.headers.get("content-type") || "";
        const baseUrl = response.url || url;

        if ([301, 302, 303, 307, 308].includes(response.status)) {
            const location = response.headers.get("location");
            return new NextResponse(null, {
                status: response.status,
                headers: location
                    ? {
                        Location: toProxyUrl(location, baseUrl, projectId, scriptMode, bridgeNonce),
                        ...corsHeaders(req),
                        "Referrer-Policy": "strict-origin-when-cross-origin",
                    }
                    : {
                        ...corsHeaders(req),
                        "Referrer-Policy": "strict-origin-when-cross-origin",
                    },
            });
        }

        if (!contentType.includes("text/html")) {
            if (contentType.includes("text/css")) {
                const readResult = await readBoundedBody(response, MAX_CSS_BYTES);
                if (readResult.exceeded || !readResult.buffer) {
                    return NextResponse.json({ error: "CSS payload exceeds size limit (2MB)" }, { status: 413 });
                }
                const css = rewriteCssUrls(readResult.buffer.toString("utf8"), baseUrl, projectId, scriptMode, bridgeNonce);
                return new NextResponse(css, {
                    status: response.status,
                    headers: {
                        "Content-Type": contentType,
                        ...corsHeaders(req),
                        "Cache-Control": "private, max-age=3600",
                        "Referrer-Policy": "strict-origin-when-cross-origin",
                    },
                });
            }

            const readResult = await readBoundedBody(response, MAX_ASSET_BYTES);
            if (readResult.exceeded || !readResult.buffer) {
                return NextResponse.json({ error: "Asset payload exceeds size limit (10MB)" }, { status: 413 });
            }
            return new NextResponse(new Uint8Array(readResult.buffer), {
                status: response.status,
                headers: {
                    "Content-Type": contentType,
                    ...corsHeaders(req),
                    "Cache-Control": "private, max-age=3600",
                    "Referrer-Policy": "strict-origin-when-cross-origin",
                },
            });
        }

        const readResult = await readBoundedBody(response, MAX_HTML_BYTES);
        if (readResult.exceeded || !readResult.buffer) {
            return NextResponse.json({ error: "HTML payload exceeds size limit (5MB)" }, { status: 413 });
        }
        let html = readResult.buffer.toString("utf8");

        let schemaFields: SchemaField[] = [];
        if (ownedProject && ownedProject.generatedSchema) {
            schemaFields = ownedProject.generatedSchema as unknown as SchemaField[];
        }

        if (schemaFields && schemaFields.length > 0) {
            html = patchHtmlWithSchema(html, schemaFields);
        }

        const has3dModelField = schemaFields.some((f) => f.type === "3d-model") || req.nextUrl.searchParams.get("has3d") === "1";
        const patchScript = createPatchScript(bridgeNonce, has3dModelField);

        html = rewriteHtmlAssets(html, baseUrl, projectId, scriptMode, bridgeNonce);

        html = /<\/body>/i.test(html)
            ? html.replace(/<\/body>/i, `${patchScript}</body>`)
            : `${html}${patchScript}`;

        return new NextResponse(html, {
            status: response.status,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                ...corsHeaders(req),
                "Content-Security-Policy": "frame-ancestors 'self'",
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "private, no-store",
                "Referrer-Policy": "strict-origin-when-cross-origin",
            },
        });
    } catch (err: unknown) {
        console.error("Proxy error:", err);
        return NextResponse.json({ error: "Failed to proxy URL." }, { status: 500 });
    }
}
