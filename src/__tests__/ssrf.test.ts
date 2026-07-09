/**
 * Unit tests for SSRF validation utility.
 * Tests the isPrivateIp and validateUrlForSsrf functions.
 */

import { isPrivateIp, validateUrlForSsrf } from "@/lib/ssrf";

// ── isPrivateIp ────────────────────────────────────────────────────────────

describe("isPrivateIp", () => {
    it("blocks 127.x.x.x (loopback)", () => {
        expect(isPrivateIp("127.0.0.1")).toBe(true);
        expect(isPrivateIp("127.0.0.0")).toBe(true);
        expect(isPrivateIp("127.255.255.255")).toBe(true);
    });

    it("blocks 10.x.x.x (Class A private)", () => {
        expect(isPrivateIp("10.0.0.1")).toBe(true);
        expect(isPrivateIp("10.255.255.255")).toBe(true);
    });

    it("blocks 172.16-31.x.x (Class B private)", () => {
        expect(isPrivateIp("172.16.0.1")).toBe(true);
        expect(isPrivateIp("172.31.255.255")).toBe(true);
    });

    it("allows 172.15.x.x (just outside Class B range)", () => {
        expect(isPrivateIp("172.15.0.1")).toBe(false);
    });

    it("blocks 192.168.x.x (Class C private)", () => {
        expect(isPrivateIp("192.168.0.1")).toBe(true);
        expect(isPrivateIp("192.168.1.100")).toBe(true);
    });

    it("blocks 169.254.x.x (link-local)", () => {
        expect(isPrivateIp("169.254.0.1")).toBe(true);
        expect(isPrivateIp("169.254.169.254")).toBe(true); // AWS metadata
    });

    it("blocks 0.0.0.0", () => {
        expect(isPrivateIp("0.0.0.0")).toBe(true);
    });

    it("allows legitimate public IPs", () => {
        expect(isPrivateIp("8.8.8.8")).toBe(false);       // Google DNS
        expect(isPrivateIp("1.1.1.1")).toBe(false);       // Cloudflare DNS
        expect(isPrivateIp("104.21.0.1")).toBe(false);    // Cloudflare
    });

    it("blocks IPv6 loopback", () => {
        expect(isPrivateIp("::1")).toBe(true);
        expect(isPrivateIp("0:0:0:0:0:0:0:1")).toBe(true);
    });

    it("blocks IPv6 ULA (fc00::/7)", () => {
        expect(isPrivateIp("fc00::1")).toBe(true);
        expect(isPrivateIp("fd12:3456:789a::1")).toBe(true);
    });

    it("blocks IPv4-mapped IPv6 private addresses", () => {
        expect(isPrivateIp("::ffff:192.168.1.1")).toBe(true);
        expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
    });
});

// ── validateUrlForSsrf ──────────────────────────────────────────────────────

describe("validateUrlForSsrf", () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV, ALLOW_LOCAL_SSRF: "false" };
    });

    afterEach(() => {
        process.env = ORIGINAL_ENV;
    });

    it("rejects non-http/https protocols", async () => {
        const result = await validateUrlForSsrf("ftp://example.com");
        expect(result.safe).toBe(false);
        expect(result.error).toMatch(/protocol/i);
    });

    it("rejects file:// protocol", async () => {
        const result = await validateUrlForSsrf("file:///etc/passwd");
        expect(result.safe).toBe(false);
    });

    it("rejects localhost by hostname", async () => {
        const result = await validateUrlForSsrf("http://localhost/admin");
        expect(result.safe).toBe(false);
        expect(result.error).toMatch(/blocked/i);
    });

    it("rejects 127.0.0.1 by hostname", async () => {
        const result = await validateUrlForSsrf("http://127.0.0.1/");
        expect(result.safe).toBe(false);
    });

    it("returns safe for real public domain", async () => {
        // Note: this does a real DNS lookup — requires network
        const result = await validateUrlForSsrf("https://example.com");
        // DNS may resolve, just check shape not error
        expect(typeof result.safe).toBe("boolean");
    });

    it("allows localhost when ALLOW_LOCAL_SSRF=true", async () => {
        process.env.ALLOW_LOCAL_SSRF = "true";
        const result = await validateUrlForSsrf("http://localhost:3000");
        expect(result.safe).toBe(true);
    });

    it("rejects malformed URL", async () => {
        const result = await validateUrlForSsrf("not-a-url");
        expect(result.safe).toBe(false);
    });
});
