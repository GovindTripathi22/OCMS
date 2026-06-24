// OCMS Ghost Cursor SDK

export interface GhostEvent {
    source: "ocms-editor";
    type: "AI_EDIT_START" | "AI_EDIT_END";
    selector?: string;
    text?: string;
}

class GhostCursor {
    private cursorEl: HTMLDivElement;
    private highlightEl: HTMLDivElement;
    private isInitialized = false;

    constructor() {
        this.cursorEl = document.createElement("div");
        this.highlightEl = document.createElement("div");
    }

    public init() {
        if (this.isInitialized) return;
        
        this.injectStyles();
        this.createElements();
        this.setupListener();
        
        this.isInitialized = true;
        console.log("[OCMS Ghost SDK] Initialized.");
    }

    private injectStyles() {
        const style = document.createElement("style");
        style.textContent = `
            .ocms-ghost-cursor {
                position: fixed;
                top: 0;
                left: 0;
                z-index: 999999;
                pointer-events: none;
                transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease;
                opacity: 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .ocms-ghost-cursor svg {
                width: 24px;
                height: 24px;
                fill: none;
                stroke: #10b981; /* Emerald 500 */
                stroke-width: 2;
                stroke-linecap: round;
                stroke-linejoin: round;
                filter: drop-shadow(0 4px 6px rgba(16, 185, 129, 0.4));
            }
            .ocms-ghost-label {
                background: #10b981;
                color: white;
                font-family: monospace;
                font-size: 11px;
                font-weight: bold;
                padding: 4px 8px;
                border-radius: 4px;
                box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
            }
            .ocms-ghost-highlight {
                position: fixed;
                z-index: 999998;
                pointer-events: none;
                border: 2px dashed #10b981;
                background: rgba(16, 185, 129, 0.1);
                transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
                opacity: 0;
                border-radius: 4px;
            }
        `;
        document.head.appendChild(style);
    }

    private createElements() {
        // Cursor
        this.cursorEl.className = "ocms-ghost-cursor";
        this.cursorEl.innerHTML = `
            <svg viewBox="0 0 24 24">
                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                <path d="M13 13l6 6" />
            </svg>
            <div class="ocms-ghost-label">OCMS Editor</div>
        `;
        document.body.appendChild(this.cursorEl);

        // Highlight
        this.highlightEl.className = "ocms-ghost-highlight";
        document.body.appendChild(this.highlightEl);
    }

    private setupListener() {
        window.addEventListener("message", (event) => {
            const data = event.data as GhostEvent;
            
            // Only process messages from OCMS editor
            if (data?.source !== "ocms-editor") return;

            if (data.type === "AI_EDIT_START" && data.selector) {
                this.moveToElement(data.selector, data.text);
            } else if (data.type === "AI_EDIT_END") {
                this.hide();
            }
        });
    }

    private moveToElement(selector: string, text?: string) {
        try {
            const el = document.querySelector(selector);
            if (!el) {
                console.warn(`[OCMS Ghost SDK] Element not found: ${selector}`);
                return;
            }

            const rect = el.getBoundingClientRect();
            
            // Show highlight
            this.highlightEl.style.top = `${rect.top}px`;
            this.highlightEl.style.left = `${rect.left}px`;
            this.highlightEl.style.width = `${rect.width}px`;
            this.highlightEl.style.height = `${rect.height}px`;
            this.highlightEl.style.opacity = "1";

            // Move cursor to center of element
            const cursorX = rect.left + rect.width / 2;
            const cursorY = rect.top + rect.height / 2;
            
            this.cursorEl.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
            this.cursorEl.style.opacity = "1";

            if (text) {
                const label = this.cursorEl.querySelector('.ocms-ghost-label');
                if (label) label.textContent = text;
            }

        } catch (e) {
            console.error("[OCMS Ghost SDK] Error moving to element:", e);
        }
    }

    private hide() {
        this.cursorEl.style.opacity = "0";
        this.highlightEl.style.opacity = "0";
    }
}

// Auto-initialize if running in browser
if (typeof window !== "undefined") {
    const ghost = new GhostCursor();
    // Delay initialization slightly to ensure DOM is ready
    setTimeout(() => ghost.init(), 100);
}

export default GhostCursor;
