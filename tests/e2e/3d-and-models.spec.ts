import { test, expect } from "@playwright/test";

test.describe("3D Engine, Procedural Textures & Asset Security", () => {
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    const res = await request.post("/api/projects", {
      data: {
        name: "3D Engine Test " + Date.now(),
        url: "http://127.0.0.1:3000/test-fixture.html",
      },
    });
    const proj = await res.json();
    projectId = proj.id;
  });

  test("deterministic procedural texture generator works without AI", async ({ request }) => {
    // 1. Wood preset
    const woodRes = await request.post("/api/generate-texture", {
      data: { prompt: "rustic dark wood plank texture" },
    });
    expect(woodRes.status()).toBe(200);
    const woodBody = await woodRes.json();
    expect(woodBody.success).toBe(true);
    expect(woodBody.mode).toBe("procedural-local");
    expect(woodBody.textureUrl).toMatch(/^data:image\/svg\+xml;base64,/);

    // 2. Chrome / Silver preset
    const chromeRes = await request.post("/api/generate-texture", {
      data: { prompt: "polished chrome metal reflection" },
    });
    expect(chromeRes.status()).toBe(200);
    const chromeBody = await chromeRes.json();
    expect(chromeBody.textureUrl).toMatch(/^data:image\/svg\+xml;base64,/);

    // 3. Carbon fiber preset
    const cfRes = await request.post("/api/generate-texture", {
      data: { prompt: "matte carbon fiber weave" },
    });
    expect(cfRes.status()).toBe(200);
    const cfBody = await cfRes.json();
    expect(cfBody.textureUrl).toMatch(/^data:image\/svg\+xml;base64,/);

    // 4. Invalid empty prompt rejected
    const emptyRes = await request.post("/api/generate-texture", {
      data: { prompt: "   " },
    });
    expect(emptyRes.status()).toBe(400);
  });

  test("3D asset upload rejects non-3D file formats", async ({ request }) => {
    // Attempt uploading an executable or HTML file as a 3D model
    const fakeBuffer = Buffer.from("<script>alert('pwned')</script>", "utf-8");
    const uploadRes = await request.post("/api/upload-model", {
      multipart: {
        projectId,
        file: {
          name: "exploit.html",
          mimeType: "text/html",
          buffer: fakeBuffer,
        },
      },
    });
    expect([400, 415, 422]).toContain(uploadRes.status());
  });

  test("variants endpoint enforces project ownership and tenant isolation", async ({ request }) => {
    // Attempt to access variants for an asset that doesn't exist or belongs to another user
    const res = await request.get("/api/variants?assetId=cuid_fake_asset_999999");
    expect([400, 404]).toContain(res.status());
  });
});
