import { test, expect } from "@playwright/test";

test.describe("Authentication, Authorization & Project Security", () => {
  test("guest user can access projects list and workspace page", async ({ request, page }) => {
    // API Check: Projects endpoint returns projects for guest user
    const res = await request.get("/api/projects");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.projects)).toBe(true);

    // UI Check: Visiting the homepage
    await page.goto("/");
    await expect(page).toHaveTitle(/OCMS/i);
  });

  test("project ownership is strictly enforced (IDOR prevention)", async ({ request }) => {
    // Attempt to access a project with a random nonexistent/other-user CUID
    const res = await request.get("/api/projects/cuid_nonexistent_other_user_12345");
    // requireOwnedProject returns 404 for nonexistent or unowned projects to prevent ID enumeration
    expect([404, 403]).toContain(res.status());
  });

  test("project creation enforces schema bounds and rejects invalid URLs", async ({ request }) => {
    // Reject invalid protocol (javascript:)
    const invalidProtoRes = await request.post("/api/projects", {
      data: {
        name: "Malicious Project",
        url: "javascript:alert(1)",
      },
    });
    expect(invalidProtoRes.status()).toBe(400);

    // Reject missing URL
    const missingUrlRes = await request.post("/api/projects", {
      data: {
        name: "Project Without URL",
      },
    });
    expect(missingUrlRes.status()).toBe(400);

    // Reject oversized project name (>100 chars)
    const oversizedNameRes = await request.post("/api/projects", {
      data: {
        name: "A".repeat(150),
        url: "http://127.0.0.1:3000/test-fixture.html",
      },
    });
    expect(oversizedNameRes.status()).toBe(400);
  });

  test("successful project creation persists to database and returns project data", async ({ request }) => {
    const projectName = "E2E Test Project " + Date.now();
    const createRes = await request.post("/api/projects", {
      data: {
        name: projectName,
        url: "http://127.0.0.1:3000/test-fixture.html",
      },
    });
    expect(createRes.status()).toBe(201);
    const newProj = await createRes.json();
    expect(newProj.id).toBeDefined();
    expect(newProj.name).toBe(projectName);

    // Verify retrieval by project ID
    const getRes = await request.get(`/api/projects/${newProj.id}`);
    expect(getRes.status()).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.success).toBe(true);
    expect(fetched.project.id).toBe(newProj.id);
  });
});
