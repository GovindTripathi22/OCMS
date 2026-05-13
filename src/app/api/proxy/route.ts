import { NextRequest, NextResponse } from "next/server";

const PROXY_PATH = "/api/proxy?url=";

function isSkippableUrl(value: string) {
    const trimmed = value.trim();
    return (
        !trimmed ||
        trimmed.startsWith("#") ||
        trimmed.startsWith("data:") ||
        trimmed.startsWith("blob:") ||
        trimmed.startsWith("mailto:") ||
        trimmed.startsWith("tel:") ||
        trimmed.startsWith("javascript:") ||
        trimmed.startsWith(PROXY_PATH)
    );
}

function toProxyUrl(value: string, baseUrl: string) {
    if (isSkippableUrl(value)) return value;

    try {
        const absoluteUrl = new URL(value, baseUrl).toString();
        return `${PROXY_PATH}${encodeURIComponent(absoluteUrl)}`;
    } catch {
        return value;
    }
}

function rewriteSrcset(value: string, baseUrl: string) {
    return value
        .split(",")
        .map((entry) => {
            const parts = entry.trim().split(/\s+/);
            if (!parts[0]) return entry;
            return [toProxyUrl(parts[0], baseUrl), ...parts.slice(1)].join(" ");
        })
        .join(", ");
}

function rewriteCssUrls(css: string, baseUrl: string) {
    return css.replace(/url\((['"]?)(?!data:|blob:|#)([^'")]+)\1\)/gi, (_match, quote, assetUrl) => {
        return `url(${quote}${toProxyUrl(assetUrl, baseUrl)}${quote})`;
    });
}

function rewriteHtmlAssets(html: string, baseUrl: string) {
    let rewritten = html.replace(/<base[^>]*>/gi, "");

    rewritten = rewritten.replace(
        /\s(src|href|data-src|poster|action)=("([^"]*)"|'([^']*)')/gi,
        (match, attr, _quoted, doubleValue, singleValue) => {
            const value = doubleValue ?? singleValue ?? "";
            const quote = doubleValue === undefined ? "'" : '"';
            return ` ${attr}=${quote}${toProxyUrl(value, baseUrl)}${quote}`;
        }
    );

    rewritten = rewritten.replace(
        /\s(srcset)=("([^"]*)"|'([^']*)')/gi,
        (match, attr, _quoted, doubleValue, singleValue) => {
            const value = doubleValue ?? singleValue ?? "";
            const quote = doubleValue === undefined ? "'" : '"';
            return ` ${attr}=${quote}${rewriteSrcset(value, baseUrl)}${quote}`;
        }
    );

    rewritten = rewritten.replace(
        /\sstyle=("([^"]*)"|'([^']*)')/gi,
        (match, _quoted, doubleValue, singleValue) => {
            const value = doubleValue ?? singleValue ?? "";
            const quote = doubleValue === undefined ? "'" : '"';
            return ` style=${quote}${rewriteCssUrls(value, baseUrl)}${quote}`;
        }
    );

    return rewritten;
}

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get("url");

    if (!url) {
        return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    try {
        const response = await fetch(url, {
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
                    ? { Location: toProxyUrl(location, baseUrl), "Access-Control-Allow-Origin": "*" }
                    : { "Access-Control-Allow-Origin": "*" },
            });
        }

        // If it's NOT HTML, proxy it directly with the correct content type
        if (!contentType.includes("text/html")) {
            if (contentType.includes("text/css")) {
                const css = rewriteCssUrls(await response.text(), baseUrl);
                return new NextResponse(css, {
                    status: response.status,
                    headers: {
                        "Content-Type": contentType,
                        "Access-Control-Allow-Origin": "*",
                        "Cache-Control": "public, max-age=31536000",
                    },
                });
            }

            const buffer = await response.arrayBuffer();
            return new NextResponse(buffer, {
                status: response.status,
                headers: {
                    "Content-Type": contentType,
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=31536000",
                },
            });
        }

        // It is HTML, so we apply our patches
        let html = await response.text();

        const patchScript = `
<script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>
<script>
(function() {
    const editableFields = new Map();
    let activeField = null;
    let toolbar = null;

    function ensureToolbar() {
        if (toolbar) return toolbar;
        toolbar = document.createElement('div');
        toolbar.id = 'ocms-floating-toolbar';
        toolbar.style.cssText = [
            'position:fixed',
            'z-index:2147483647',
            'display:none',
            'gap:6px',
            'padding:6px',
            'background:#0f172a',
            'border:1px solid rgba(148,163,184,.35)',
            'border-radius:8px',
            'box-shadow:0 12px 30px rgba(15,23,42,.28)',
            'font:12px system-ui,-apple-system,Segoe UI,sans-serif'
        ].join(';');
        [
            ['summarize', 'Summarize'],
            ['change-tone', 'Change Tone']
        ].forEach(([action, label]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.style.cssText = 'border:0;border-radius:6px;padding:6px 8px;background:#7c3aed;color:white;cursor:pointer;font:inherit';
            button.onclick = () => {
                if (!activeField) return;
                window.parent.postMessage({
                    source: 'ocms-toolbar-action',
                    action,
                    fieldId: activeField.fieldId,
                    selector: activeField.selector,
                    value: activeField.el.innerText || activeField.el.textContent || ''
                }, '*');
            };
            toolbar.appendChild(button);
        });
        document.body.appendChild(toolbar);
        return toolbar;
    }

    function showToolbar(field) {
        activeField = field;
        const bar = ensureToolbar();
        const rect = field.el.getBoundingClientRect();
        bar.style.left = Math.max(8, rect.left) + 'px';
        bar.style.top = Math.max(8, rect.top - 42) + 'px';
        bar.style.display = 'flex';
    }

    function hideToolbarSoon() {
        window.setTimeout(() => {
            if (!toolbar || toolbar.matches(':hover') || (activeField && activeField.el === document.activeElement)) return;
            toolbar.style.display = 'none';
        }, 150);
    }

    function applyField(field) {
        const selector = field.selector || (field.field && field.field.selector);
        if (!selector) return;
        const el = document.querySelector(selector);
        if (!el) return;

        const type = field.type || (field.field && field.field.type);
        const value = field.value || '';
        const fieldId = field.fieldId || field.id || selector;
        el.setAttribute('data-ocms-field-id', fieldId);

        if (type === 'text') {
            el.setAttribute('contenteditable', 'true');
            el.setAttribute('data-ocms-field-id', fieldId);
            el.style.cursor = 'text';
            el.style.outline = '1px dashed rgba(139, 92, 246, 0.35)';
            editableFields.set(fieldId, { el, fieldId, selector });

            el.onfocus = () => showToolbar({ el, fieldId, selector });
            el.onblur = hideToolbarSoon;
            el.oninput = () => {
                window.parent.postMessage({
                    source: 'ocms-inline-edit',
                    fieldId,
                    selector,
                    newValue: el.innerText
                }, '*');
            };

            if (document.activeElement !== el) el.innerText = value;
            return;
        }

        if (type === 'image') {
            if (el.tagName === 'IMG') el.setAttribute('src', value);
            else el.style.backgroundImage = 'url(' + value + ')';
            return;
        }

        if (type === '3d-model') {
            let mv = el.tagName && el.tagName.toLowerCase() === 'model-viewer' ? el : null;
            if (!mv) {
                mv = document.createElement('model-viewer');
                mv.style.width = el.clientWidth ? el.clientWidth + 'px' : '100%';
                mv.style.height = el.clientHeight ? el.clientHeight + 'px' : '360px';
                el.replaceWith(mv);
            }
            mv.setAttribute('src', value);
            mv.setAttribute('auto-rotate', '');
            mv.setAttribute('camera-controls', '');
        }
    }

    // 1. Security Fixes
    try {
        Object.defineProperty(window.history, 'pushState', { value: function() {}, writable: false });
        Object.defineProperty(window.history, 'replaceState', { value: function() {}, writable: false });
    } catch(e) {}

    // 2. OCMS Live Bridge - Two-Way Sync
    window.addEventListener('message', (event) => {
        const { source, changes, type, selector, text } = event.data;
        
        if (source === 'ocms-live-bridge' && changes) {
            changes.forEach(applyField);
        }

        // 3. Ghost Cursor Visualization
        if (source === 'ocms-editor' && type === 'AI_EDIT_START') {
            const el = document.querySelector(selector);
            if (el) {
                el.style.outline = '2px solid #8b5cf6';
                el.style.backgroundColor = 'rgba(139, 92, 246, 0.1)';
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        if (source === 'ocms-editor' && type === 'AI_EDIT_END') {
            const el = document.querySelector(selector);
            if (el) {
                el.style.outline = 'none';
                el.style.backgroundColor = 'transparent';
            }
        }
    });

    document.addEventListener('dragover', (event) => {
        if ([...event.dataTransfer.types].includes('Files')) event.preventDefault();
    });

    document.addEventListener('drop', (event) => {
        const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        if (!file || !/\\.glb$|\\.gltf$/i.test(file.name)) return;
        event.preventDefault();
        const target = event.target && event.target.closest('[data-ocms-field-id]');
        window.parent.postMessage({
            source: 'ocms-model-drop',
            fieldId: target ? target.getAttribute('data-ocms-field-id') : null,
            file
        }, '*');
    });

    console.log("OCMS Live Bridge Initialized");
})();
</script>`;

        html = rewriteHtmlAssets(html, baseUrl);

        // Inject script right before closing body tag
        html = /<\/body>/i.test(html)
            ? html.replace(/<\/body>/i, `${patchScript}</body>`)
            : `${html}${patchScript}`;

        return new NextResponse(html, {
            status: response.status,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Access-Control-Allow-Origin": "*",
                "X-Frame-Options": "ALLOWALL",
                "Content-Security-Policy": "frame-ancestors *",
            },
        });
    } catch (err: unknown) {
        console.error("Proxy error:", err);
        return NextResponse.json({ error: "Failed to proxy URL." }, { status: 500 });
    }
}
