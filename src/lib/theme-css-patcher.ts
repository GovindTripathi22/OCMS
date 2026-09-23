export const THEME_PROPS = [
    "--theme-background",
    "--theme-primary",
    "--theme-secondary",
    "--theme-accent",
    "--theme-text",
] as const;

/**
 * Deterministic CSS patcher that inserts or updates the five theme-color
 * custom properties inside the `:root` block. If no `:root` block exists,
 * one is prepended. All other CSS, comments, and declarations are preserved verbatim.
 */
export function patchCssWithThemeColors(currentCss: string, colors: string[]): string {
    const declarations = THEME_PROPS.map(
        (prop, i) => `    ${prop}: ${colors[i]};`
    ).join("\n");

    const rootBlockRe = /(:root\s*\{)([\s\S]*?)(\})/;
    const match = currentCss.match(rootBlockRe);

    if (match) {
        let innerContent = match[2];
        for (const prop of THEME_PROPS) {
            const propLineRe = new RegExp(
                `^[ \t]*${prop.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\s*:[^;]*;[ \t]*\r?\n?`,
                "gm"
            );
            innerContent = innerContent.replace(propLineRe, "");
        }

        const trimmed = innerContent.trimEnd();
        const separator = trimmed.length > 0 ? "\n\n" : "\n";
        const updatedInner = trimmed + separator + declarations + "\n";
        return currentCss.replace(rootBlockRe, () => `${match[1]}${updatedInner}${match[3]}`);
    }

    const rootBlock = `:root {\n${declarations}\n}\n\n`;
    return rootBlock + currentCss;
}
