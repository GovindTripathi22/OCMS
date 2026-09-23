/**
 * OCMS Live Preview Receiver Script
 * ==================================
 * Hardened DOM receiver for live preview synchronization.
 * Validates message source, origin, nonce, and bounded payload sizes.
 *
 * Usage:
 *   <script src="/ocms-receiver.js" data-allowed-origin="https://your-app.example.com" data-nonce="YOUR_NONCE"></script>
 */
(function () {
    // Determine configuration from current script tag or globals
    var currentScript = document.currentScript;
    var configuredOrigin = (currentScript && currentScript.getAttribute("data-allowed-origin")) || window.__OCMS_ALLOWED_ORIGIN__ || "";
    var configuredNonce = (currentScript && currentScript.getAttribute("data-nonce")) || window.__OCMS_NONCE__ || "";

    var MAX_CHANGES = 100;
    var MAX_SELECTOR_LENGTH = 500;
    var MAX_VALUE_LENGTH = 50000;

    window.addEventListener("message", function (event) {
        // 1. Source verification: must originate from parent iframe or opener
        if (event.source !== window.parent && event.source !== window.opener) {
            return;
        }

        // 2. Origin verification if configured
        if (configuredOrigin && configuredOrigin !== "*") {
            if (event.origin !== configuredOrigin) {
                console.warn("[OCMS Receiver] Origin rejected:", event.origin);
                return;
            }
        }

        // 3. Payload sanity check
        var data = event.data;
        if (!data || typeof data !== "object" || data.source !== "ocms-live-bridge") {
            return;
        }

        // 4. Nonce verification if configured
        if (configuredNonce && data.nonce !== configuredNonce) {
            console.warn("[OCMS Receiver] Nonce mismatch rejected");
            return;
        }

        var changes = data.changes;
        if (!Array.isArray(changes) || changes.length > MAX_CHANGES) {
            console.warn("[OCMS Receiver] Invalid or oversized changes array");
            return;
        }

        changes.forEach(function (change) {
            if (!change || typeof change !== "object") return;
            var selector = change.selector;
            var value = change.value;

            if (typeof value !== "string" || value.length > MAX_VALUE_LENGTH) return;
            if (selector && (typeof selector !== "string" || selector.length > MAX_SELECTOR_LENGTH)) return;

            var el = null;
            if (selector) {
                try {
                    el = document.querySelector(selector);
                } catch (e) {}
            }

            // Fallback: data-ocms-field attribute binding
            if (!el && change.fieldId && typeof change.fieldId === "string") {
                try {
                    el = document.querySelector('[data-ocms-field="' + CSS.escape(change.fieldId) + '"]') ||
                         document.querySelector('[data-ocms-field-id="' + CSS.escape(change.fieldId) + '"]');
                } catch (e) {}
            }

            if (!el) return;

            if (change.type === "image") {
                if (el.tagName === "IMG") {
                    el.src = value;
                    if (change.alt !== undefined) el.alt = change.alt;
                } else {
                    el.style.backgroundImage = "url(" + value + ")";
                }
                if (change.objectFit) el.style.objectFit = change.objectFit;
                if (change.borderRadius) el.style.borderRadius = change.borderRadius;
            } else if (change.type === "link") {
                if (el.tagName === "A") {
                    // Reject javascript: and data: protocols
                    var lcValue = value.toLowerCase().trim();
                    if (lcValue.indexOf("javascript:") === 0 || lcValue.indexOf("data:") === 0 || lcValue.indexOf("vbscript:") === 0) {
                        // Dangerous protocol — do not set
                    } else {
                        el.href = value;
                    }
                }
            } else if (change.type === "3d-model") {
                if (el.tagName.toLowerCase() === "model-viewer") {
                    el.setAttribute("src", value);
                    if (change.roughness !== undefined) el.setAttribute("roughness", String(change.roughness));
                    if (change.metalness !== undefined) el.setAttribute("metalness", String(change.metalness));
                }
            } else {
                // Text updates — always use textContent to prevent XSS
                el.textContent = value;
            }
        });
    });
})();
