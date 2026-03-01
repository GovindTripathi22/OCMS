/**
 * OCMS Live Preview Receiver Script
 * ==================================
 * Paste this into the <head> of the target website being edited inside OCMS.
 * It listens for postMessage events from the OCMS Live Workspace and updates
 * the DOM in real-time as the user types into the Content Editor.
 *
 * Usage:
 *   <script src="https://your-ocms-host.com/ocms-receiver.js"></script>
 *   OR copy-paste the contents into a <script> tag in the target page's <head>.
 */
(function () {
    window.addEventListener("message", function (event) {
        // Only accept messages from OCMS
        if (!event.data || event.data.source !== "ocms-live-bridge") return;

        var changes = event.data.changes;
        if (!Array.isArray(changes)) return;

        changes.forEach(function (change) {
            if (!change.selector) return;

            var el = document.querySelector(change.selector);
            if (!el) return;

            if (change.type === "image") {
                // Update image src
                if (el.tagName === "IMG") {
                    el.src = change.value;
                } else {
                    el.style.backgroundImage = "url(" + change.value + ")";
                }
            } else if (change.type === "link") {
                // Update href
                if (el.tagName === "A") {
                    el.href = change.value;
                }
            } else {
                // Update text content
                el.textContent = change.value;
            }
        });
    });
})();
