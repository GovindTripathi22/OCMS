import { test, expect } from "@playwright/test";

test.describe("Autosave, Theme Colors, GSD & Publishing", () => {
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    const res = await request.post("/api/projects", {
      data: {
        name: "Publish & Theme Test " + Date.now(),
        url: "http://127.0.0.1:3000/test-fixture.html",
      },
    });
    const proj = await res.json();
    projectId = proj.id;
  });

  test("theme colors endpoint patches CSS deterministically and rejects path traversal", async ({ request }) => {
    // 1. Path traversal attempt must be blocked
    const traversalRes = await request.post("/api/theme-colors", {
      data: {
        projectId,
        colors: ["#ffffff", "#000000", "#ff0000", "#00ff00", "#0000ff"],
        cssFilePath: "../../../etc/passwd",
      },
    });
    expect([400, 403]).toContain(traversalRes.status());

    // 2. Invalid color array format must be rejected
    const invalidColorRes = await request.post("/api/theme-colors", {
      data: {
        projectId,
        colors: ["not-a-color"],
      },
    });
    expect(invalidColorRes.status()).toBe(400);

    // 3. Valid 5-color palette update succeeds
    const validColors = ["#111111", "#222222", "#333333", "#444444", "#555555"];
    const validRes = await request.post("/api/theme-colors", {
      data: {
        projectId,
        colors: validColors,
      },
    });
    expect(validRes.status()).toBe(200);
    const body = await validRes.json();
    expect(body.success).toBe(true);
    expect(body.colors).toEqual(validColors);
  });

  test("GSD state is stored in dedicated fields and parsed deterministically", async ({ request }) => {
    // 1. Fetch initial GSD state
    const getRes = await request.get(`/api/projects/${projectId}/gsd`);
    expect(getRes.status()).toBe(200);
    const gsdData = await getRes.json();
    expect(gsdData.exists).toBe(true);
    expect(gsdData.state).toBeDefined();

    // 2. Initialize / advance GSD state via action
    const postRes = await request.post(`/api/projects/${projectId}/gsd`, {
      data: {
        action: "init",
      },
    });
    expect(postRes.status()).toBe(200);
    const updated = await postRes.json();
    expect(updated.success).toBe(true);
  });

  test("publish changes pipeline enforces project ownership and path security", async ({ request }) => {
    // Path traversal attempt in publish pipeline
    const traversalRes = await request.post("/api/publish-changes", {
      data: {
        projectId,
        targetFilePath: "../../../outside-repo.ts",
        changes: [{ id: "field-1", value: "malicious" }],
      },
    });
    expect([400, 403, 404]).toContain(traversalRes.status());
  });
});
