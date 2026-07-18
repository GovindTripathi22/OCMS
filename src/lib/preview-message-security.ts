export type PreviewScriptMode = "static" | "dynamic";

interface PreviewMessageValidationInput {
    event: Pick<MessageEvent, "origin" | "source" | "data">;
    expectedOrigin: string;
    expectedSource: WindowProxy | null | undefined;
    expectedNonce: string;
    scriptMode: PreviewScriptMode;
}

export function isExpectedPreviewMessage({ event, expectedOrigin, expectedSource, expectedNonce, scriptMode }: PreviewMessageValidationInput): boolean {
    const isExpectedOrigin = event.origin === expectedOrigin || (scriptMode === "dynamic" && event.origin === "null");
    return isExpectedOrigin && event.source === expectedSource && Boolean(event.data) && event.data.nonce === expectedNonce;
}
