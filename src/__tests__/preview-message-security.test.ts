import { isExpectedPreviewMessage } from "@/lib/preview-message-security";

const source = {} as WindowProxy;
const nonce = "preview-nonce";
const origin = "http://localhost:3000";

function event(overrides: Partial<Pick<MessageEvent, "origin" | "source" | "data">> = {}): Pick<MessageEvent, "origin" | "source" | "data"> {
    return { origin, source, data: { nonce }, ...overrides };
}

describe("isExpectedPreviewMessage", () => {
    it("accepts same-origin static preview messages", () => {
        expect(isExpectedPreviewMessage({ event: event(), expectedOrigin: origin, expectedSource: source, expectedNonce: nonce, scriptMode: "static" })).toBe(true);
    });

    it("accepts opaque-origin dynamic preview messages", () => {
        expect(isExpectedPreviewMessage({ event: event({ origin: "null" }), expectedOrigin: origin, expectedSource: source, expectedNonce: nonce, scriptMode: "dynamic" })).toBe(true);
    });

    it("rejects opaque-origin static messages and mismatched bridge data", () => {
        const input = { expectedOrigin: origin, expectedSource: source, expectedNonce: nonce, scriptMode: "static" as const };
        expect(isExpectedPreviewMessage({ ...input, event: event({ origin: "null" }) })).toBe(false);
        expect(isExpectedPreviewMessage({ ...input, event: event({ data: { nonce: "wrong" } }) })).toBe(false);
        expect(isExpectedPreviewMessage({ ...input, event: event({ source: {} as WindowProxy }) })).toBe(false);
    });
});
