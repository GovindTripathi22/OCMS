import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as cheerio from "cheerio";

interface SchemaField {
    id: string;
    type: "text" | "image" | "link" | "3d-model";
    label: string;
    value: string;
    selector?: string;
    originalHtmlTag?: string;
}

const PROXY_PATH = "/api/proxy?url=";
type ScriptMode = "static" | "dynamic";

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

function toProxyUrl(value: string, baseUrl: string, projectId?: string, scriptMode: ScriptMode = "static") {
    if (isSkippableUrl(value)) return value;

    try {
        const absoluteUrl = new URL(value, baseUrl).toString();
        let proxyUrl = `${PROXY_PATH}${encodeURIComponent(absoluteUrl)}`;
        if (projectId) {
            proxyUrl += `&projectId=${encodeURIComponent(projectId)}`;
        }
        if (scriptMode === "dynamic") {
            proxyUrl += `&scriptMode=dynamic`;
        }
        return proxyUrl;
    } catch {
        return value;
    }
}

function rewriteSrcset(value: string, baseUrl: string, projectId?: string, scriptMode: ScriptMode = "static") {
    return value
        .split(",")
        .map((entry) => {
            const parts = entry.trim().split(/\s+/);
            if (!parts[0]) return entry;
            return [toProxyUrl(parts[0], baseUrl, projectId, scriptMode), ...parts.slice(1)].join(" ");
        })
        .join(", ");
}

function rewriteCssUrls(css: string, baseUrl: string, projectId?: string, scriptMode: ScriptMode = "static") {
    return css.replace(/url\((['"]?)(?!data:|blob:|#)([^'")]+)\1\)/gi, (_match, quote, assetUrl) => {
        return `url(${quote}${toProxyUrl(assetUrl, baseUrl, projectId, scriptMode)}${quote})`;
    });
}

function isJsonDataScript(scriptTag: string) {
    const typeMatch = scriptTag.match(/\stype=(["'])(.*?)\1/i);
    const type = (typeMatch?.[2] || "").trim().toLowerCase();
    return ["application/ld+json", "application/json", "application/schema+json"].includes(type);
}

function filterScripts(html: string, scriptMode: ScriptMode) {
    return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (scriptTag) => {
        if (isJsonDataScript(scriptTag)) return scriptTag;
        return scriptMode === "dynamic" ? scriptTag : "";
    });
}

function rewriteHtmlAssets(html: string, baseUrl: string, projectId?: string, scriptMode: ScriptMode = "static") {
    let rewritten = html.replace(/<base[^>]*>/gi, "");

    // Strip pre-existing referrer meta tags to avoid conflicts
    rewritten = rewritten.replace(/<meta[^>]*name=["']referrer["'][^>]*>/gi, "");

    // Static mode strips executable scripts but preserves JSON data such as JSON-LD.
    // Dynamic mode keeps scripts and relies on the iframe sandbox plus history guard.
    rewritten = filterScripts(rewritten, scriptMode);
    rewritten = rewritten.replace(/\s(integrity|nonce)=("([^"]*)"|'([^']*)')/gi, "");

    // Inject meta referrer and CSS overrides inside <head> if present
    const referrerMeta = `
<meta name="referrer" content="unsafe-url">
<script id="ocms-history-guard">
(function() {
  try {
    window.__OCMS_PREVIEW__ = true;
    var noop = function() {};
    Object.defineProperty(window.history, 'pushState', { value: noop, configurable: true });
    Object.defineProperty(window.history, 'replaceState', { value: noop, configurable: true });

    var baseUrl = ${JSON.stringify(baseUrl)};
    var projectId = ${JSON.stringify(projectId || "")};
    var scriptMode = ${JSON.stringify(scriptMode)};
    var proxyPath = "/api/proxy?url=";

    var originalFetch = window.fetch;
    window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
        if (url.indexOf('chrome-extension://') === 0 || url.indexOf('data:') === 0 || url.indexOf('/_next/webpack-hmr') === 0) {
            return originalFetch(input, init);
        }
        if (url.indexOf('/') === 0 && url.indexOf('//') !== 0) {
            url = baseUrl.replace(/\\/$/, '') + url;
        }
        var proxiedUrl = proxyPath + encodeURIComponent(url);
        if (projectId) proxiedUrl += '&projectId=' + encodeURIComponent(projectId);
        if (scriptMode) proxiedUrl += '&scriptMode=' + encodeURIComponent(scriptMode);
        
        if (typeof input === 'string') {
            return originalFetch(proxiedUrl, init);
        } else {
            var newRequest = new Request(proxiedUrl, input);
            return originalFetch(newRequest, init);
        }
    };

    var originalOpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        if (url.indexOf('chrome-extension://') !== 0 && url.indexOf('data:') !== 0 && url.indexOf('/_next/webpack-hmr') !== 0) {
            if (url.indexOf('/') === 0 && url.indexOf('//') !== 0) {
                url = baseUrl.replace(/\\/$/, '') + url;
            }
            var proxiedUrl = proxyPath + encodeURIComponent(url);
            if (projectId) proxiedUrl += '&projectId=' + encodeURIComponent(projectId);
            if (scriptMode) proxiedUrl += '&scriptMode=' + encodeURIComponent(scriptMode);
            return originalOpen.call(this, method, proxiedUrl, async, user, password);
        }
        return originalOpen.call(this, method, url, async, user, password);
    };

    window.addEventListener('beforeunload', function(event) { event.preventDefault(); });
  } catch (e) {}
})();
</script>
<style id="ocms-iframe-overrides">
  /* Force visibility of wrapper elements that hide content before hydration */
  body > div[style*="visibility:hidden"], 
  body > div[style*="visibility: hidden"],
  body > div[style*="opacity:0"],
  body > div[style*="opacity: 0"] {
    visibility: visible !important;
    opacity: 1 !important;
  }
  /* Hide the loader/spinner overlay screens */
  div[class*="fixed"][class*="inset-0"][class*="z-[9999]"][class*="bg-[#050505]"],
  div[class*="fixed"][class*="inset-0"][class*="z-[9999]"][class*="bg-black"],
  div[class*="fixed"][class*="inset-0"][class*="z-[9999]"][class*="bg-background"],
  div[class*="fixed"][class*="bg-[#050505]"] {
    display: none !important;
  }
  
  /* Floating Toolbar Enhancements */
  #ocms-floating-toolbar {
    transition: opacity 0.15s ease;
  }
  #ocms-floating-toolbar button {
    transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
  }
  #ocms-floating-toolbar button:hover {
    background: #6d28d9 !important;
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(124, 58, 237, 0.45);
  }
  #ocms-floating-toolbar button:active {
    transform: translateY(0);
    box-shadow: none;
  }
</style>
`;
    if (/<head[^>]*>/i.test(rewritten)) {
        rewritten = rewritten.replace(/<head[^>]*>/i, (match) => `${match}${referrerMeta}`);
    } else {
        rewritten = `${referrerMeta}${rewritten}`;
    }

    rewritten = rewritten.replace(
        /\s(src|href|data-src|poster|action)=("([^"]*)"|'([^']*)')/gi,
        (match, attr, _quoted, doubleValue, singleValue) => {
            const value = doubleValue ?? singleValue ?? "";
            const quote = doubleValue === undefined ? "'" : '"';
            return ` ${attr}=${quote}${toProxyUrl(value, baseUrl, projectId, scriptMode)}${quote}`;
        }
    );

    rewritten = rewritten.replace(
        /\s(srcset)=("([^"]*)"|'([^']*)')/gi,
        (match, attr, _quoted, doubleValue, singleValue) => {
            const value = doubleValue ?? singleValue ?? "";
            const quote = doubleValue === undefined ? "'" : '"';
            return ` ${attr}=${quote}${rewriteSrcset(value, baseUrl, projectId, scriptMode)}${quote}`;
        }
    );

    rewritten = rewritten.replace(
        /\sstyle=("([^"]*)"|'([^']*)')/gi,
        (match, _quoted, doubleValue, singleValue) => {
            const value = doubleValue ?? singleValue ?? "";
            const quote = doubleValue === undefined ? "'" : '"';
            return ` style=${quote}${rewriteCssUrls(value, baseUrl, projectId, scriptMode)}${quote}`;
        }
    );

    return rewritten;
}

export async function GET(req: NextRequest) {
    let url = "";
    const rawUrl = req.url;
    const urlParamIndex = rawUrl.indexOf("?url=");
    if (urlParamIndex !== -1) {
        let rawParam = rawUrl.substring(urlParamIndex + 5);
        const controlParamIndex = ["&projectId=", "&scriptMode="]
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

    // SSRF URL Security Validation
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
            return NextResponse.json(
                { error: "Only http and https protocols are supported" },
                { status: 400 }
            );
        }

        const hostname = parsedUrl.hostname.toLowerCase();
        const isLocalAllowed = process.env.NODE_ENV === "development" || process.env.ALLOW_LOCAL_SSRF === "true";
        
        if (!isLocalAllowed) {
            if (
                hostname === "localhost" ||
                hostname === "127.0.0.1" ||
                hostname === "[::1]" ||
                hostname === "0.0.0.0"
            ) {
                return NextResponse.json(
                    { error: "Localhost and loopback URLs are blocked in production" },
                    { status: 403 }
                );
            }

            const isIp = /^[0-9.]+$/.test(hostname);
            if (isIp) {
                const parts = hostname.split(".").map(Number);
                if (parts.length === 4) {
                    const [p1, p2] = parts;
                    if (
                        p1 === 10 ||
                        (p1 === 172 && p2 >= 16 && p2 <= 31) ||
                        (p1 === 192 && p2 === 168) ||
                        (p1 === 169 && p2 === 254)
                    ) {
                        return NextResponse.json(
                            { error: "Private network URLs are blocked in production" },
                            { status: 403 }
                        );
                    }
                }
            }
        }
    } catch {
        return NextResponse.json(
            { error: "Invalid URL format" },
            { status: 400 }
        );
    }

    const projectId = req.nextUrl.searchParams.get("projectId") || "";
    const scriptMode: ScriptMode = req.nextUrl.searchParams.get("scriptMode") === "dynamic" ? "dynamic" : "static";

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
                    ? { 
                        Location: toProxyUrl(location, baseUrl, projectId, scriptMode), 
                        "Access-Control-Allow-Origin": "*",
                        "Referrer-Policy": "unsafe-url"
                      }
                    : { 
                        "Access-Control-Allow-Origin": "*",
                        "Referrer-Policy": "unsafe-url"
                      },
            });
        }

        if (!contentType.includes("text/html")) {
            if (contentType.includes("text/css")) {
                const css = rewriteCssUrls(await response.text(), baseUrl, projectId, scriptMode);
                return new NextResponse(css, {
                    status: response.status,
                    headers: {
                        "Content-Type": contentType,
                        "Access-Control-Allow-Origin": "*",
                        "Cache-Control": "public, max-age=31536000",
                        "Referrer-Policy": "unsafe-url",
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
                    "Referrer-Policy": "unsafe-url",
                },
            });
        }

        let html = await response.text();

        let schemaFields: SchemaField[] = [];
        if (projectId) {
            try {
                const project = await prisma.project.findUnique({
                    where: { id: projectId },
                    select: { generatedSchema: true },
                });
                if (project && project.generatedSchema) {
                    schemaFields = project.generatedSchema as unknown as SchemaField[];
                }
            } catch (dbErr) {
                console.error("[Proxy DB Schema Fetch Error]:", dbErr);
            }
        }

        if (schemaFields && schemaFields.length > 0) {
            try {
                const $ = cheerio.load(html);
                let modified = false;

                for (const field of schemaFields) {
                    if (!field.selector || !field.value) continue;
                    let $el: ReturnType<typeof $>;
                    try {
                        $el = $(field.selector);
                    } catch (selectorErr) {
                        console.warn("[Proxy Schema Selector Error]:", field.selector, selectorErr);
                        continue;
                    }
                    if ($el.length > 0) {
                        if (field.type === "text") {
                            $el.text(field.value);
                            modified = true;
                        } else if (field.type === "image") {
                            if ($el.is("img")) {
                                $el.attr("src", field.value);
                            } else {
                                $el.css("background-image", `url(${field.value})`);
                            }
                            modified = true;
                        } else if (field.type === "link") {
                            $el.attr("href", field.value);
                            modified = true;
                        }
                    }
                }

                if (modified) {
                    html = $.html();
                }
            } catch (cheerioErr) {
                console.error("[Cheerio Patch Error]:", cheerioErr);
            }
        }

        const has3dModelField = schemaFields.some(f => f.type === "3d-model") || req.nextUrl.searchParams.get("has3d") === "1";
        const modelViewerScript = has3dModelField
            ? `<script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>`
            : "";

        const patchScript = `
${modelViewerScript}
<script>
(function() {
    const editableFields = new Map();
    const boundElements = new WeakSet();
    let latestChanges = [];
    let activeField = null;
    let toolbar = null;
    let mutationTimer = null;
    let currentlyEditingEl = null;
    let imageHoverToolbar = null;
    let imageFileInput = null;
    let currentHoveredImage = null;
    let inspectorEnabled = false;
    let hoveredInspectorEl = null;

    function getCssSelector(el) {
        if (el.id) {
            return '#' + el.id;
        }
        if (el === document.body) {
            return 'body';
        }
        var tagName = el.tagName.toLowerCase();
        if (el.className) {
            var classes = Array.from(el.classList).filter(c => !c.startsWith('js-') && !c.startsWith('gtm-') && !c.startsWith('ocms-'));
            if (classes.length > 0) {
                var selector = tagName + classes.map(c => '.' + CSS.escape(c)).join('');
                try {
                    if (document.querySelectorAll(selector).length === 1) {
                        return selector;
                    }
                } catch(e) {}
            }
        }
        var path = [];
        while (el && el.nodeType === Node.ELEMENT_NODE) {
            var selector = el.nodeName.toLowerCase();
            if (el.id) {
                selector += '#' + el.id;
                path.unshift(selector);
                break;
            } else {
                var sib = el, sibIndex = 1;
                while (sib = sib.previousElementSibling) {
                    if (sib.nodeName.toLowerCase() === el.nodeName.toLowerCase()) {
                        sibIndex++;
                    }
                }
                selector += ":nth-of-type(" + sibIndex + ")";
            }
            path.unshift(selector);
            el = el.parentNode;
        }
        return path.join(' > ');
    }

    function normalizeText(value) {
        return String(value || '').replace(/\\s+/g, ' ').trim();
    }

    function getSelectionOffset(root) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || !root.contains(selection.anchorNode)) return null;
        const range = selection.getRangeAt(0);
        const preRange = range.cloneRange();
        preRange.selectNodeContents(root);
        preRange.setEnd(range.startContainer, range.startOffset);
        return {
            start: preRange.toString().length,
            end: preRange.toString().length + range.toString().length
        };
    }

    function restoreSelectionOffset(root, saved) {
        if (!saved) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        let current = 0;
        let startSet = false;
        let node = walker.nextNode();

        while (node) {
            const next = current + node.nodeValue.length;
            if (!startSet && saved.start <= next) {
                range.setStart(node, Math.max(0, saved.start - current));
                startSet = true;
            }
            if (startSet && saved.end <= next) {
                range.setEnd(node, Math.max(0, saved.end - current));
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                return;
            }
            current = next;
            node = walker.nextNode();
        }

        range.selectNodeContents(root);
        range.collapse(false);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    function ensureToolbar() {
        if (toolbar) return toolbar;
        toolbar = document.createElement('div');
        toolbar.id = 'ocms-floating-toolbar';
        toolbar.style.cssText = [
            'position:fixed !important',
            'z-index:2147483647 !important',
            'display:none !important',
            'gap:8px !important',
            'padding:8px !important',
            'background:#fcfbf9 !important',
            'border:3px solid #000 !important',
            'border-radius:10px !important',
            'box-shadow:6px 6px 0px #000 !important',
            'font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif !important',
            'box-sizing:border-box !important'
        ].join(';');
        [
            ['summarize', 'Summarize'],
            ['change-tone', 'Change Tone']
        ].forEach(([action, label]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.style.cssText = [
                'border:2px solid #000 !important',
                'border-radius:6px !important',
                'padding:6px 10px !important',
                'background:#7c3aed !important',
                'color:#fff !important',
                'cursor:pointer !important',
                'font-size:10px !important',
                'font-weight:900 !important',
                'text-transform:uppercase !important',
                'letter-spacing:0.5px !important',
                'box-shadow:2px 2px 0px #000 !important',
                'transition:transform 0.1s ease, box-shadow 0.1s ease !important',
                'font-family:inherit !important',
                'outline:none !important'
            ].join(';');
            button.onmouseover = () => {
                button.style.transform = 'translate(-1px, -1px)';
                button.style.boxShadow = '3px 3px 0px #000';
            };
            button.onmouseout = () => {
                button.style.transform = 'none';
                button.style.boxShadow = '2px 2px 0px #000';
            };
            button.onmousedown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (!activeField) return;
                const elToBlur = activeField.el;
                const fieldId = activeField.fieldId;
                const selector = activeField.selector;
                const textVal = elToBlur.innerText || elToBlur.textContent || '';
                
                elToBlur.blur();
                
                window.parent.postMessage({
                    source: 'ocms-toolbar-action',
                    action,
                    fieldId,
                    selector,
                    value: textVal
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
            activeField = null;
        }, 150);
    }

    function safeQueryAll(selector) {
        try {
            return Array.from(document.querySelectorAll(selector));
        } catch (error) {
            console.warn('[OCMS] Invalid selector skipped:', selector, error);
            return [];
        }
    }

    function bindTextElement(el, fieldId, selector) {
        if (!boundElements.has(el)) {
            el.addEventListener('focus', () => {
                currentlyEditingEl = el;
                el.style.outline = '2px solid rgba(124, 58, 237, 0.95)';
                showToolbar({ el, fieldId: el.getAttribute('data-ocms-field-id') || fieldId, selector });
            });
            el.addEventListener('blur', () => {
                if (currentlyEditingEl === el) currentlyEditingEl = null;
                el.style.outline = '1px dashed rgba(139, 92, 246, 0.45)';
                hideToolbarSoon();
            });
            el.addEventListener('input', () => {
                window.parent.postMessage({
                    source: 'ocms-inline-edit',
                    fieldId: el.getAttribute('data-ocms-field-id') || fieldId,
                    selector: el.getAttribute('data-ocms-selector') || selector,
                    newValue: el.innerText
                }, '*');
            });
            boundElements.add(el);
        }
    }

    function applyField(field) {
        const selector = field.selector || (field.field && field.field.selector);
        if (!selector) return;

        const type = field.type || (field.field && field.field.type);
        const value = field.value || '';
        const fieldId = field.fieldId || field.id || selector;
        const elements = safeQueryAll(selector);
        if (!elements.length) return;

        elements.forEach((el) => {
            if (type === 'text') {
                el.setAttribute('data-ocms-field-id', fieldId);
                el.setAttribute('data-ocms-selector', selector);
                el.setAttribute('contenteditable', 'true');
                el.setAttribute('spellcheck', 'true');
                el.style.cursor = 'text';
                el.style.userSelect = 'text';
                el.style.webkitUserSelect = 'text';
                el.style.outline = (el === document.activeElement || currentlyEditingEl === el) ? '2px solid rgba(124, 58, 237, 0.95)' : '1px dashed rgba(139, 92, 246, 0.45)';
                el.style.outlineOffset = '3px';
                bindTextElement(el, fieldId, selector);

                if (currentlyEditingEl !== el && document.activeElement !== el && normalizeText(el.innerText) !== normalizeText(value)) {
                    const saved = getSelectionOffset(el);
                    el.innerText = value;
                    restoreSelectionOffset(el, saved);
                }
                editableFields.set(fieldId, { el, fieldId, selector });
                return;
            }

            if (type === 'link') {
                if (el.tagName === 'A') {
                    el.setAttribute('href', value);
                    if (el.getAttribute('contenteditable') !== 'true') {
                        el.style.outline = '1px dashed rgba(34, 197, 94, 0.45)';
                        el.style.outlineOffset = '3px';
                    }
                }
                return;
            }

            if (type === 'image') {
                const alt = field.alt || (field.field && field.field.alt);
                const objectFit = field.objectFit || (field.field && field.field.objectFit);
                const borderRadius = field.borderRadius || (field.field && field.field.borderRadius);

                if (el.tagName === 'IMG') {
                    el.setAttribute('src', value);
                    if (alt !== undefined && alt !== null) {
                        el.setAttribute('alt', alt);
                    }
                } else {
                    el.style.backgroundImage = 'url(' + value + ')';
                }

                if (objectFit) {
                    el.style.objectFit = objectFit;
                }
                if (borderRadius) {
                    el.style.borderRadius = borderRadius;
                }

                if (el.getAttribute('contenteditable') !== 'true') {
                    el.style.outline = '1px dashed rgba(6, 182, 212, 0.45)';
                    el.style.outlineOffset = '3px';
                }
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

                // Apply material settings
                const roughness = field.roughness !== undefined ? field.roughness : (field.field && field.field.roughness);
                const metalness = field.metalness !== undefined ? field.metalness : (field.field && field.field.metalness);
                const textureUrl = field.textureUrl || (field.field && field.field.textureUrl);

                if (roughness !== undefined && roughness !== null) {
                    mv.setAttribute('roughness', String(roughness));
                }
                if (metalness !== undefined && metalness !== null) {
                    mv.setAttribute('metalness', String(metalness));
                }
                if (textureUrl) {
                    mv.setAttribute('texture-url', textureUrl);
                }

                const applyMaterials = async () => {
                    if (!mv.model) {
                        setTimeout(applyMaterials, 100);
                        return;
                    }
                    const material = mv.model.materials[0];
                    if (material) {
                        if (typeof roughness === 'number') {
                            material.pbrMetallicRoughness.setRoughnessFactor(roughness);
                        }
                        if (typeof metalness === 'number') {
                            material.pbrMetallicRoughness.setMetallicFactor(metalness);
                        }
                        if (textureUrl) {
                            try {
                                const texture = await mv.createTexture(textureUrl);
                                if (material.pbrMetallicRoughness.baseColorTexture) {
                                    await material.pbrMetallicRoughness.baseColorTexture.setTexture(texture);
                                }
                            } catch (e) {
                                console.error("[ModelViewer Material Update Error]:", e);
                            }
                        }
                    }
                };
                applyMaterials();
            }
        });
    }

    function applyAllFields() {
        latestChanges.forEach(applyField);
    }

    function scheduleApplyAllFields() {
        window.clearTimeout(mutationTimer);
        mutationTimer = window.setTimeout(applyAllFields, 80);
    }

    try {
        Object.defineProperty(window.history, 'pushState', { value: function() {}, configurable: true });
        Object.defineProperty(window.history, 'replaceState', { value: function() {}, configurable: true });
    } catch(e) {}

    document.addEventListener('click', (event) => {
        const anchor = event.target && event.target.closest ? event.target.closest('a') : null;
        if (!anchor) return;

        const matchesEditable = latestChanges.some((field) => {
            if (!field.selector) return false;
            return safeQueryAll(field.selector).some((el) => el === anchor || el.contains(anchor) || anchor.contains(el));
        });

        if (matchesEditable) {
            event.preventDefault();
            event.stopPropagation();
            if (anchor.getAttribute('contenteditable') === 'true') anchor.focus();
        }
    }, true);

    function getTargetPathname() {
        try {
            var searchParams = new URLSearchParams(window.location.search);
            var targetUrl = searchParams.get('url');
            if (targetUrl) {
                if (targetUrl.indexOf('http') === 0 || targetUrl.indexOf('//') === 0) {
                    return new URL(targetUrl, window.location.origin).pathname;
                }
                return targetUrl.split('?')[0];
            }
        } catch (e) {}
        return '/';
    }

    function triggerImageEdit(img, forceType) {
        var selector = getCssSelector(img);
        var path = getTargetPathname();
        var type = forceType || (img.tagName.toLowerCase() === 'model-viewer' ? '3d-model' : 'image');
        var value = img.src || img.getAttribute('data-src') || '';
        if (!value && img.style && img.style.backgroundImage) {
            var bgMatch = img.style.backgroundImage.match(/url\((['\"]?)(.*?)\\1\)/);
            if (bgMatch) value = bgMatch[2];
        }
        var label = img.alt ? 'Image: ' + img.alt : 'Image Element';

        var fieldId = img.getAttribute('data-ocms-field-id') || 'field-' + Date.now();
        img.setAttribute('data-ocms-field-id', fieldId);
        img.setAttribute('data-ocms-selector', selector);

        window.parent.postMessage({
            source: 'ocms-doubleclick-image',
            field: {
                id: fieldId,
                type: type,
                label: label.slice(0, 30),
                value: value,
                selector: selector,
                originalHtmlTag: img.tagName.toLowerCase(),
                path: path
            }
        }, '*');
    }

    function ensureImageHoverToolbar() {
        if (imageHoverToolbar) return imageHoverToolbar;

        // Create container
        imageHoverToolbar = document.createElement('div');
        imageHoverToolbar.id = 'ocms-image-hover-toolbar';
        imageHoverToolbar.style.cssText = [
            'position:absolute !important',
            'z-index:2147483645 !important',
            'display:none !important',
            'align-items:center !important',
            'gap:6px !important',
            'padding:6px !important',
            'background:#fcfbf9 !important',
            'border:3px solid #000 !important',
            'border-radius:10px !important',
            'box-shadow:4px 4px 0px #000 !important',
            'font-family:system-ui, -apple-system, sans-serif !important',
            'pointer-events:auto !important',
            'box-sizing:border-box !important'
        ].join(';');

        // Create file input
        imageFileInput = document.createElement('input');
        imageFileInput.type = 'file';
        imageFileInput.accept = 'image/*';
        imageFileInput.style.display = 'none';
        imageFileInput.onchange = (e) => {
            const file = e.target.files?.[0];
            if (file && currentHoveredImage) {
                const img = currentHoveredImage;
                const selector = getCssSelector(img);
                const fieldId = img.getAttribute('data-ocms-field-id') || 'field-' + Date.now();
                img.setAttribute('data-ocms-field-id', fieldId);
                img.setAttribute('data-ocms-selector', selector);
                const path = getTargetPathname();

                // Add field to parent first
                window.parent.postMessage({
                    source: 'ocms-inline-add-field',
                    field: {
                        id: fieldId,
                        type: 'image',
                        label: img.alt ? 'Image: ' + img.alt : 'Image Element',
                        value: img.src || '',
                        selector: selector,
                        originalHtmlTag: img.tagName.toLowerCase(),
                        path: path
                    }
                }, '*');

                // Read and set file
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const base64Url = evt.target.result;
                    if (img.tagName === 'IMG') {
                        img.setAttribute('src', base64Url);
                    } else {
                        img.style.backgroundImage = 'url(' + base64Url + ')';
                    }
                    window.parent.postMessage({
                        source: 'ocms-inline-edit',
                        fieldId: fieldId,
                        selector: selector,
                        newValue: base64Url
                    }, '*');
                };
                reader.readAsDataURL(file);
            }
        };
        imageHoverToolbar.appendChild(imageFileInput);

        // Helper to create buttons
        const createBtn = (label, bg, color, onClick) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.style.cssText = [
                'border:2.5px solid #000 !important',
                'border-radius:6px !important',
                'padding:4px 8px !important',
                'background:' + bg + ' !important',
                'color:' + color + ' !important',
                'cursor:pointer !important',
                'font-size:9px !important',
                'font-weight:900 !important',
                'text-transform:uppercase !important',
                'letter-spacing:0.5px !important',
                'box-shadow:2px 2px 0px #000 !important',
                'transition:transform 0.1s ease, box-shadow 0.1s ease !important',
                'font-family:inherit !important',
                'outline:none !important',
                'white-space:nowrap !important'
            ].join(';');
            btn.innerHTML = label;
            btn.onmouseover = () => {
                btn.style.transform = 'translate(-1px, -1px)';
                btn.style.boxShadow = '3px 3px 0px #000';
            };
            btn.onmouseout = () => {
                btn.style.transform = 'none';
                btn.style.boxShadow = '2px 2px 0px #000';
            };
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick();
            };
            return btn;
        };

        // Button 1: Upload (Image replacement)
        const uploadBtn = createBtn('📷 REPLACE', '#22c55e', '#000', () => {
            imageFileInput.click();
        });

        // Button 2: Basic Features (Alt Text, Object Fit, Border Corners)
        const basicBtn = createBtn('⚙️ FEATURES', '#3b82f6', '#fff', () => {
            if (currentHoveredImage) {
                triggerImageEdit(currentHoveredImage, 'image');
            }
        });

        // Button 3: Convert to 3D Model
        const modelBtn = createBtn('📦 3D MODEL', '#f97316', '#000', () => {
            if (currentHoveredImage) {
                triggerImageEdit(currentHoveredImage, '3d-model');
            }
        });

        imageHoverToolbar.appendChild(uploadBtn);
        imageHoverToolbar.appendChild(basicBtn);
        imageHoverToolbar.appendChild(modelBtn);

        document.body.appendChild(imageHoverToolbar);
        return imageHoverToolbar;
    }

    function clearInspectorEffects() {
        if (hoveredInspectorEl) {
            hoveredInspectorEl.style.outline = hoveredInspectorEl.dataset.ocmsOldOutline || '';
            hoveredInspectorEl.style.outlineOffset = hoveredInspectorEl.dataset.ocmsOldOutlineOffset || '';
            hoveredInspectorEl.style.cursor = hoveredInspectorEl.dataset.ocmsOldCursor || '';
            hoveredInspectorEl = null;
        }
    }

    document.addEventListener('mouseover', (event) => {
        if (!inspectorEnabled) return;
        const el = event.target;
        if (!el || el === document.body || el === document.documentElement || el.id === 'ocms-floating-toolbar' || el.closest('#ocms-floating-toolbar') || el.closest('#ocms-image-hover-toolbar')) return;

        const inspectableTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'li', 'button', 'a', 'img', 'model-viewer'];
        const tag = el.tagName.toLowerCase();
        if (!inspectableTags.includes(tag) && !el.closest('a') && !el.closest('button')) return;

        const targetEl = el.closest('a') || el.closest('button') || el;

        if (hoveredInspectorEl && hoveredInspectorEl !== targetEl) {
            clearInspectorEffects();
        }

        if (!hoveredInspectorEl) {
            hoveredInspectorEl = targetEl;
            targetEl.dataset.ocmsOldOutline = targetEl.style.outline;
            targetEl.dataset.ocmsOldOutlineOffset = targetEl.style.outlineOffset;
            targetEl.dataset.ocmsOldCursor = targetEl.style.cursor;

            targetEl.style.outline = '2px dashed #f97316';
            targetEl.style.outlineOffset = '2px';
            targetEl.style.cursor = 'pointer';
        }
        event.preventDefault();
        event.stopPropagation();
    }, true);

    document.addEventListener('mouseout', (event) => {
        if (!inspectorEnabled) return;
        const el = event.target;
        if (hoveredInspectorEl && (el === hoveredInspectorEl || !hoveredInspectorEl.contains(el))) {
            clearInspectorEffects();
        }
        event.preventDefault();
        event.stopPropagation();
    }, true);

    document.addEventListener('click', (event) => {
        if (!inspectorEnabled) return;
        const el = event.target;
        if (!el || el.id === 'ocms-floating-toolbar' || el.closest('#ocms-floating-toolbar') || el.closest('#ocms-image-hover-toolbar')) return;

        const inspectableTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'li', 'button', 'a', 'img', 'model-viewer'];
        const tag = el.tagName.toLowerCase();
        if (!inspectableTags.includes(tag) && !el.closest('a') && !el.closest('button')) return;

        const targetEl = el.closest('a') || el.closest('button') || el;

        event.preventDefault();
        event.stopPropagation();

        const selector = getCssSelector(targetEl);
        const path = getTargetPathname();
        const elTag = targetEl.tagName.toLowerCase();
        let type = 'text';
        let value = targetEl.innerText || targetEl.textContent || '';

        if (elTag === 'img') {
            type = 'image';
            value = targetEl.src || targetEl.getAttribute('data-src') || '';
        } else if (elTag === 'model-viewer') {
            type = '3d-model';
            value = targetEl.getAttribute('src') || '';
        } else if (elTag === 'a') {
            type = 'link';
            value = targetEl.getAttribute('href') || '';
        }

        const label = type.toUpperCase() + ': ' + (value.trim().slice(0, 20) || selector);
        const fieldId = targetEl.getAttribute('data-ocms-field-id') || 'field-' + Date.now();

        targetEl.setAttribute('data-ocms-field-id', fieldId);
        targetEl.setAttribute('data-ocms-selector', selector);

        window.parent.postMessage({
            source: 'ocms-inline-add-field',
            field: {
                id: fieldId,
                type: type,
                label: label.slice(0, 30),
                value: value,
                selector: selector,
                originalHtmlTag: elTag,
                path: path
            }
        }, '*');

        const prevBg = targetEl.style.backgroundColor;
        targetEl.style.backgroundColor = 'rgba(34, 197, 94, 0.3)';
        setTimeout(() => {
            targetEl.style.backgroundColor = prevBg;
        }, 500);

        clearInspectorEffects();
    }, true);

    document.addEventListener('mouseover', (event) => {
        const el = event.target;
        if (!el || el.id === 'ocms-image-hover-toolbar' || el.closest('#ocms-image-hover-toolbar') || el.closest('#ocms-floating-toolbar')) return;

        const img = el.tagName === 'IMG' ? el : el.closest('img');
        const hasBg = !img && window.getComputedStyle && window.getComputedStyle(el).backgroundImage !== 'none';
        const targetImg = img || (hasBg ? el : null);

        if (targetImg && !targetImg.id.startsWith('ocms-')) {
            currentHoveredImage = targetImg;
            const toolbar = ensureImageHoverToolbar();
            const rect = targetImg.getBoundingClientRect();

            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            const toolbarWidth = 270;
            let leftPos = rect.left + scrollLeft + (rect.width - toolbarWidth) / 2;
            if (leftPos < scrollLeft + 6) leftPos = scrollLeft + 6;

            let topPos = rect.top + scrollTop - 48;
            if (topPos < scrollTop + 6) {
                topPos = rect.top + scrollTop + 6;
            }

            toolbar.style.left = leftPos + 'px';
            toolbar.style.top = topPos + 'px';
            toolbar.style.display = 'flex';
        } else {
            if (imageHoverToolbar && (!currentHoveredImage || (el !== currentHoveredImage && !currentHoveredImage.contains(el)))) {
                if (!event.relatedTarget || (event.relatedTarget !== imageHoverToolbar && !imageHoverToolbar.contains(event.relatedTarget))) {
                    imageHoverToolbar.style.display = 'none';
                }
            }
        }
    });

    document.addEventListener('dblclick', (event) => {
        var el = event.target;
        if (!el || el === document.body || el === document.documentElement) return;

        // Skip input/textarea fields or already focused editables
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.getAttribute('contenteditable') === 'true') return;

        event.preventDefault();
        event.stopPropagation();

        var modelViewer = el.closest('model-viewer') || 
                          el.querySelector('model-viewer') || 
                          (el.parentElement && el.parentElement.querySelector('model-viewer'));
        var img = el.closest('img') || 
                  el.querySelector('img') || 
                  (el.parentElement && el.parentElement.querySelector('img')) ||
                  (window.getComputedStyle(el).backgroundImage !== 'none' ? el : null);
        var anchor = el.closest('a') || el.querySelector('a') || (el.parentElement && el.parentElement.closest('a'));
        var button = el.closest('button') || 
                     el.querySelector('button') || 
                     (el.parentElement && el.parentElement.querySelector('button')) ||
                     el.closest('.btn') ||
                     el.closest('.button') ||
                     el.closest('[role="button"]') ||
                     el.closest('[class*="btn-"]') ||
                     el.closest('[class*="button-"]');

        var targetEl = modelViewer || img || anchor || button || el;
        var selector = getCssSelector(targetEl);
        var path = getTargetPathname();

        if (modelViewer) {
            var type = '3d-model';
            var value = modelViewer.getAttribute('src') || '';
            var label = '3D Model Element';
            var fieldId = modelViewer.getAttribute('data-ocms-field-id') || 'field-' + Date.now();
            modelViewer.setAttribute('data-ocms-field-id', fieldId);
            modelViewer.setAttribute('data-ocms-selector', selector);

            const roughnessAttr = modelViewer.getAttribute('roughness');
            const metalnessAttr = modelViewer.getAttribute('metalness');
            const textureUrlAttr = modelViewer.getAttribute('texture-url');

            window.parent.postMessage({
                source: 'ocms-doubleclick-image',
                field: {
                    id: fieldId,
                    type: type,
                    label: label,
                    value: value,
                    selector: selector,
                    originalHtmlTag: 'model-viewer',
                    path: path,
                    roughness: roughnessAttr ? parseFloat(roughnessAttr) : 0.5,
                    metalness: metalnessAttr ? parseFloat(metalnessAttr) : 1.0,
                    textureUrl: textureUrlAttr || ''
                }
            }, '*');
        } else if (img) {
            triggerImageEdit(img);
        } else if (anchor) {
            var textValue = anchor.innerText || anchor.textContent || '';
            var linkValue = anchor.getAttribute('href') || '';
            var textSelector = selector;

            var textFieldId = anchor.getAttribute('data-ocms-field-id') || 'field-text-' + Date.now();
            var linkFieldId = anchor.getAttribute('data-ocms-link-id') || 'field-link-' + Date.now();

            anchor.setAttribute('data-ocms-field-id', textFieldId);
            anchor.setAttribute('data-ocms-link-id', linkFieldId);
            anchor.setAttribute('data-ocms-selector', textSelector);

            // Add the text field
            window.parent.postMessage({
                source: 'ocms-inline-add-field',
                field: {
                    id: textFieldId,
                    type: 'text',
                    label: ('Link Text: ' + textValue).slice(0, 30),
                    value: textValue,
                    selector: textSelector,
                    originalHtmlTag: anchor.tagName.toLowerCase(),
                    path: path
                }
            }, '*');

            // Add the link URL field
            window.parent.postMessage({
                source: 'ocms-inline-add-field',
                field: {
                    id: linkFieldId,
                    type: 'link',
                    label: ('Link URL: ' + textValue).slice(0, 30),
                    value: linkValue,
                    selector: textSelector,
                    originalHtmlTag: anchor.tagName.toLowerCase(),
                    path: path
                }
            }, '*');

            // Make the text editable inline
            anchor.setAttribute('contenteditable', 'true');
            anchor.style.userSelect = 'text';
            anchor.style.webkitUserSelect = 'text';
            anchor.style.cursor = 'text';
            bindTextElement(anchor, textFieldId, textSelector);
            anchor.focus();
            var range = document.createRange();
            range.selectNodeContents(anchor);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);

            // Create custom modal and overlay for link destination URL
            var linkOverlay = document.createElement('div');
            linkOverlay.id = 'ocms-link-edit-overlay';
            linkOverlay.style.cssText = [
                'position:fixed !important',
                'top:0 !important',
                'left:0 !important',
                'width:100% !important',
                'height:100% !important',
                'background:rgba(0,0,0,0.5) !important',
                'z-index:2147483646 !important',
                'backdrop-filter:blur(2px) !important',
                'display:block !important'
            ].join(';');

            var linkModal = document.createElement('div');
            linkModal.id = 'ocms-link-edit-modal';
            linkModal.style.cssText = [
                'position:fixed !important',
                'top:50% !important',
                'left:50% !important',
                'transform:translate(-50%, -50%) !important',
                'z-index:2147483647 !important',
                'width:340px !important',
                'max-width:90% !important',
                'padding:24px !important',
                'background:#fcfbf9 !important',
                'border:4px solid #000 !important',
                'border-radius:12px !important',
                'box-shadow:8px 8px 0px #000 !important',
                'font-family:system-ui, -apple-system, sans-serif !important',
                'color:#000 !important',
                'display:flex !important',
                'flex-direction:column !important',
                'gap:16px !important',
                'box-sizing:border-box !important'
            ].join(';');

            // Title
            var linkTitle = document.createElement('h3');
            linkTitle.innerText = 'Change Link URL';
            linkTitle.style.cssText = 'margin:0 !important;font-size:18px !important;font-weight:900 !important;text-transform:uppercase !important;letter-spacing:-0.5px !important;font-family:inherit !important;color:#000 !important;';
            linkModal.appendChild(linkTitle);

            // URL input group
            var linkInputGroup = document.createElement('div');
            linkInputGroup.style.cssText = 'display:flex !important;flex-direction:column !important;gap:6px !important;';
            var linkLabelEl = document.createElement('label');
            linkLabelEl.innerText = 'Destination URL';
            linkLabelEl.style.cssText = 'font-size:10px !important;font-weight:900 !important;text-transform:uppercase !important;letter-spacing:0.5px !important;color:#000 !important;font-family:sans-serif !important;';
            linkInputGroup.appendChild(linkLabelEl);

            var linkUrlInput = document.createElement('input');
            linkUrlInput.type = 'text';
            linkUrlInput.value = linkValue;
            linkUrlInput.placeholder = 'https://example.com';
            linkUrlInput.style.cssText = [
                'border:3px solid #000 !important',
                'border-radius:8px !important',
                'padding:10px !important',
                'font-size:12px !important',
                'font-family:monospace !important',
                'outline:none !important',
                'background:#fff !important',
                'color:#000 !important',
                'width:100% !important',
                'box-sizing:border-box !important'
            ].join(';');
            linkInputGroup.appendChild(linkUrlInput);
            linkModal.appendChild(linkInputGroup);

            // Actions
            var linkActionGroup = document.createElement('div');
            linkActionGroup.style.cssText = 'display:flex !important;gap:12px !important;justify-content:flex-end !important;margin-top:6px !important;';

            var linkCancelBtn = document.createElement('button');
            linkCancelBtn.type = 'button';
            linkCancelBtn.innerText = 'Cancel';
            linkCancelBtn.style.cssText = [
                'background:#fff !important',
                'color:#000 !important',
                'border:3px solid #000 !important',
                'border-radius:8px !important',
                'padding:8px 16px !important',
                'font-weight:900 !important',
                'font-size:11px !important',
                'text-transform:uppercase !important',
                'cursor:pointer !important',
                'box-shadow:3px 3px 0px #000 !important',
                'font-family:sans-serif !important'
            ].join(';');
            linkCancelBtn.onclick = function() {
                cleanupLink();
            };

            var linkSaveBtn = document.createElement('button');
            linkSaveBtn.type = 'button';
            linkSaveBtn.innerText = 'Save Link';
            linkSaveBtn.style.cssText = [
                'background:#3b82f6 !important',
                'color:#fff !important',
                'border:3px solid #000 !important',
                'border-radius:8px !important',
                'padding:8px 16px !important',
                'font-weight:900 !important',
                'font-size:11px !important',
                'text-transform:uppercase !important',
                'cursor:pointer !important',
                'box-shadow:3px 3px 0px #000 !important',
                'font-family:sans-serif !important'
            ].join(';');
            linkSaveBtn.onclick = function() {
                var newHref = linkUrlInput.value.trim();
                if (newHref !== null) {
                    anchor.setAttribute('href', newHref);
                    window.parent.postMessage({
                        source: 'ocms-inline-edit',
                        fieldId: linkFieldId,
                        selector: textSelector,
                        newValue: newHref
                    }, '*');
                }
                cleanupLink();
            };

            linkActionGroup.appendChild(linkCancelBtn);
            linkActionGroup.appendChild(linkSaveBtn);
            linkModal.appendChild(linkActionGroup);

            linkOverlay.onclick = function() {
                cleanupLink();
            };

            function cleanupLink() {
                if (document.getElementById('ocms-link-edit-modal')) {
                    document.body.removeChild(linkModal);
                }
                if (document.getElementById('ocms-link-edit-overlay')) {
                    document.body.removeChild(linkOverlay);
                }
            }

            document.body.appendChild(linkOverlay);
            document.body.appendChild(linkModal);
        } else if (button) {
            var value = button.innerText || button.textContent || '';
            var label = 'Button: ' + value;
            var fieldId = button.getAttribute('data-ocms-field-id') || 'field-' + Date.now();

            button.setAttribute('data-ocms-field-id', fieldId);
            button.setAttribute('data-ocms-selector', selector);

            window.parent.postMessage({
                source: 'ocms-inline-add-field',
                field: {
                    id: fieldId,
                    type: 'text',
                    label: label.slice(0, 30),
                    value: value,
                    selector: selector,
                    originalHtmlTag: button.tagName.toLowerCase(),
                    path: path
                }
            }, '*');

            button.setAttribute('contenteditable', 'true');
            button.style.userSelect = 'text';
            button.style.webkitUserSelect = 'text';
            button.style.cursor = 'text';
            bindTextElement(button, fieldId, selector);
            button.focus();
            var range = document.createRange();
            range.selectNodeContents(button);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        } else {
            // General text elements
            var value = el.innerText || el.textContent || '';
            if (value.trim().length === 0) return;
            var label = el.tagName.toLowerCase() + ' block';
            var fieldId = el.getAttribute('data-ocms-field-id') || 'field-' + Date.now();

            el.setAttribute('data-ocms-field-id', fieldId);
            el.setAttribute('data-ocms-selector', selector);

            window.parent.postMessage({
                source: 'ocms-inline-add-field',
                field: {
                    id: fieldId,
                    type: 'text',
                    label: label.slice(0, 30),
                    value: value,
                    selector: selector,
                    originalHtmlTag: el.tagName.toLowerCase(),
                    path: path
                }
            }, '*');

            el.setAttribute('contenteditable', 'true');
            el.style.userSelect = 'text';
            el.style.webkitUserSelect = 'text';
            el.style.cursor = 'text';
            bindTextElement(el, fieldId, selector);
            el.focus();
            var range = document.createRange();
            range.selectNodeContents(el);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }, true);

    const observer = new MutationObserver((mutations) => {
        if (mutations.some((mutation) => mutation.target && mutation.target.id === 'ocms-floating-toolbar')) return;
        scheduleApplyAllFields();
    });

    function startObserver() {
        const root = document.body || document.documentElement;
        if (root) observer.observe(root, { childList: true, subtree: true });
    }

    window.addEventListener('message', (event) => {
        const { source, changes, type, selector, action, enabled } = event.data || {};
        
        if (source === 'ocms-parent' && action === 'toggle-inspector') {
            inspectorEnabled = enabled;
            if (!enabled) {
                clearInspectorEffects();
            }
        }

        if (source === 'ocms-live-bridge' && Array.isArray(changes)) {
            latestChanges = changes;
            applyAllFields();
        }

        if (source === 'ocms-material-update') {
            const { roughness, metalness, textureUrl } = event.data;
            const mv = document.querySelector('model-viewer');
            if (mv) {
                const applyMaterials = async () => {
                    if (!mv.model) {
                        setTimeout(applyMaterials, 100);
                        return;
                    }
                    const material = mv.model.materials[0];
                    if (material) {
                        if (typeof roughness === 'number') {
                            material.pbrMetallicRoughness.setRoughnessFactor(roughness);
                        }
                        if (typeof metalness === 'number') {
                            material.pbrMetallicRoughness.setMetallicFactor(metalness);
                        }
                        if (textureUrl) {
                            try {
                                const texture = await mv.createTexture(textureUrl);
                                if (material.pbrMetallicRoughness.baseColorTexture) {
                                    await material.pbrMetallicRoughness.baseColorTexture.setTexture(texture);
                                }
                            } catch (e) {
                                console.error("[ModelViewer Material Update Error]:", e);
                            }
                        }
                    }
                };
                applyMaterials();
            }
        }

        if (source === 'ocms-editor' && type === 'AI_EDIT_START') {
            const el = selector ? document.querySelector(selector) : null;
            if (el) {
                el.style.outline = '2px solid #8b5cf6';
                el.style.backgroundColor = 'rgba(139, 92, 246, 0.1)';
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        if (source === 'ocms-editor' && type === 'AI_EDIT_END') {
            const el = selector ? document.querySelector(selector) : document.querySelector('[data-ocms-field-id]');
            if (el) {
                el.style.outline = '1px dashed rgba(139, 92, 246, 0.45)';
                el.style.backgroundColor = 'transparent';
            }
        }
    });

    window.addEventListener('scroll', () => {
        if (toolbar && toolbar.style.display === 'flex') {
            toolbar.style.display = 'none';
            activeField = null;
        }
        if (imageHoverToolbar && imageHoverToolbar.style.display === 'flex') {
            imageHoverToolbar.style.display = 'none';
        }
    }, { passive: true });

    document.addEventListener('dragover', (event) => {
        if (event.dataTransfer && Array.from(event.dataTransfer.types).includes('Files')) event.preventDefault();
    });

    document.addEventListener('drop', (event) => {
        const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        if (!file) return;

        if (/\\.glb$|\\.gltf$/i.test(file.name)) {
            event.preventDefault();
            const target = event.target && event.target.closest('[data-ocms-field-id]');
            window.parent.postMessage({
                source: 'ocms-model-drop',
                fieldId: target ? target.getAttribute('data-ocms-field-id') : null,
                file
            }, '*');
            return;
        }

        if (/^image\\//i.test(file.type)) {
            event.preventDefault();
            const target = event.target && (event.target.closest('img') || (window.getComputedStyle(event.target).backgroundImage !== 'none' ? event.target : null));
            if (target) {
                var selector = getCssSelector(target);
                var fieldId = target.getAttribute('data-ocms-field-id') || 'field-' + Date.now();
                target.setAttribute('data-ocms-field-id', fieldId);
                target.setAttribute('data-ocms-selector', selector);
                var path = getTargetPathname();

                // Make sure field is registered
                window.parent.postMessage({
                    source: 'ocms-inline-add-field',
                    field: {
                        id: fieldId,
                        type: 'image',
                        label: target.alt ? 'Image: ' + target.alt : 'Image Element',
                        value: target.src || '',
                        selector: selector,
                        originalHtmlTag: target.tagName.toLowerCase(),
                        path: path
                    }
                }, '*');

                // Read and set file
                var reader = new FileReader();
                reader.onload = function(e) {
                    var base64Url = e.target.result;
                    if (target.tagName === 'IMG') {
                        target.setAttribute('src', base64Url);
                    } else {
                        target.style.backgroundImage = 'url(' + base64Url + ')';
                    }
                    window.parent.postMessage({
                        source: 'ocms-inline-edit',
                        fieldId: fieldId,
                        selector: selector,
                        newValue: base64Url
                    }, '*');
                };
                reader.readAsDataURL(file);
            }
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver, { once: true });
    } else {
        startObserver();
    }

    console.log("OCMS Live Bridge Initialized");
    window.parent.postMessage({ source: 'ocms-iframe-ready', url: window.location.href }, '*');
})();
</script>`;

        html = rewriteHtmlAssets(html, baseUrl, projectId, scriptMode);

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
                "Referrer-Policy": "unsafe-url",
            },
        });
    } catch (err: unknown) {
        console.error("Proxy error:", err);
        return NextResponse.json({ error: "Failed to proxy URL." }, { status: 500 });
    }
}
