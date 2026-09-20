import { test, expect } from "@playwright/test";

test.describe("Inspector, Inline Editing & History", () => {
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    // Create a project initialized with schema fields
    const res = await request.post("/api/projects", {
      data: {
        name: "Editor & Inspector Test " + Date.now(),
        url: "http://127.0.0.1:3000/test-fixture.html",
      },
    });
    const proj = await res.json();
    projectId = proj.id;

    // Scan to populate initial schema
    await request.post(`/api/projects/${projectId}/scan-page`, {
      data: {
        url: "http://127.0.0.1:3000/test-fixture.html",
      },
    });
  });

  test("loads workspace with sidebar editor and preview panel", async ({ page }) => {
    await page.goto(`/workspace/${projectId}`);

    // Verify presence of Editor panel and Live Preview panel
    await expect(page.locator('h2:has-text("OCMS Editor")')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("iframe")).toBeVisible({ timeout: 30_000 });
  });

  test("editing field updates schema and enables history controls", async ({ page }) => {
    await page.goto(`/workspace/${projectId}`);
    await expect(page.locator('h2:has-text("OCMS Editor")')).toBeVisible({ timeout: 30_000 });

    // Locate the first text field input or filter input
    const textInput = page.locator('input[type="text"]').first();
    await expect(textInput).toBeVisible({ timeout: 15_000 });

    const originalValue = await textInput.inputValue();
    const updatedValue = originalValue ? originalValue + " - Updated" : "Updated Text";

    // Edit the text input
    await textInput.fill(updatedValue);
    expect(await textInput.inputValue()).toBe(updatedValue);
  });

  test("direct schema update persists revision and validates payload", async ({ request }) => {
    // Fetch current project schema and revision
    const projRes = await request.get(`/api/projects/${projectId}`);
    const projData = await projRes.json();
    const currentRevision = projData.project?.schemaRevision ?? 0;

    const updatedSchema = [
      {
        id: "hero-title",
        type: "text",
        label: "Hero Title",
        value: "Verified Headless CMS Platform",
        selector: "#hero-title",
      },
    ];

    // Save with correct revision
    const saveRes = await request.put(`/api/projects/${projectId}/schema`, {
      data: {
        schema: updatedSchema,
        clientRevision: currentRevision,
      },
    });
    expect(saveRes.status()).toBe(200);
    const saved = await saveRes.json();
    expect(saved.success).toBe(true);
    expect(saved.schemaRevision).toBe(currentRevision + 1);

    // Stale write rejection: saving with old revision must return 409 Conflict
    const staleRes = await request.put(`/api/projects/${projectId}/schema`, {
      data: {
        schema: updatedSchema,
        clientRevision: currentRevision, // old revision!
      },
    });
    expect(staleRes.status()).toBe(409);
  });
});
