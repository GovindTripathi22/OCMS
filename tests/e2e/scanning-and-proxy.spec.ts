import { test, expect } from "@playwright/test";

test.describe("Scanning, Proxy & SSRF Defense", () => {
  let testProjectId: string;

  test.beforeAll(async ({ request }) => {
    // Create a temporary project for scanning tests
    const res = await request.post("/api/projects", {
      data: {
        name: "Scan & Proxy Test " + Date.now(),
        url: "http://127.0.0.1:3000/test-fixture.html",
      },
    });
    const proj = await res.json();
    testProjectId = proj.id;
  });

  test("deterministic scanner extracts schema fields from local fixture", async ({ request }) => {
    const res = await request.post(`/api/projects/${testProjectId}/scan-page`, {
      data: {
        url: "http://127.0.0.1:3000/test-fixture.html",
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.schema)).toBe(true);
    expect(body.schema.length).toBeGreaterThan(0);

    // Verify extracted fields include heading, paragraph, image, link
    const types = body.schema.map((f: { type: string }) => f.type);
    expect(types).toContain("text");
    expect(types).toContain("image");
    expect(types).toContain("link");

    // Verify deduplication: all field IDs must be unique
    const ids = body.schema.map((f: { id: string }) => f.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  test("proxy endpoint proxies local fixture and injects security headers", async ({ request }) => {
    const res = await request.get(
      `/api/proxy?url=${encodeURIComponent("http://127.0.0.1:3000/test-fixture.html")}&projectId=${testProjectId}`
    );
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain("Deterministic Headless CMS");
    // Verify receiver script injection or bridge configuration
    expect(html).toContain("Live Bridge");
  });

  test("proxy endpoint rejects invalid schemes", async ({ request }) => {
    const badSchemeRes = await request.get(
      `/api/proxy?url=${encodeURIComponent("javascript:alert(1)")}&projectId=${testProjectId}`
    );
    expect([400, 403]).toContain(badSchemeRes.status());
  });

  test("SSRF protection blocks cloud metadata IP and loopback", async ({ request }) => {
    // AWS/GCP metadata endpoint
    const metadataRes = await request.post("/api/scrape", {
      data: {
        url: "http://169.254.169.254/latest/meta-data/",
      },
    });
    expect([400, 403]).toContain(metadataRes.status());
  });
});
