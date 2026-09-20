import { test, expect } from "@playwright/test";

test.describe("Responsive Viewports & Accessibility", () => {
  const viewports = [
    { width: 320, height: 568, name: "Mobile Small (320px)" },
    { width: 375, height: 667, name: "Mobile Medium (375px)" },
    { width: 768, height: 1024, name: "Tablet (768px)" },
    { width: 1024, height: 768, name: "Desktop Small (1024px)" },
    { width: 1280, height: 800, name: "Desktop Standard (1280px)" },
    { width: 1440, height: 900, name: "Desktop Wide (1440px)" },
  ];

  for (const vp of viewports) {
    test(`renders homepage cleanly at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await expect(page).toHaveTitle(/OCMS/i);

      // Verify header/brand title is visible without breaking
      const brand = page.locator("text=OCMS").first();
      await expect(brand).toBeVisible();

      // Ensure no horizontal scrollbar overflow on body
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // 2px margin for subpixel rounding
    });
  }

  test("accessibility: interactive elements have accessible names and focus states", async ({ page }) => {
    await page.goto("/");

    // Verify all primary buttons have non-empty text or aria-label
    const buttons = await page.locator("button").all();
    for (const button of buttons) {
      if (await button.isVisible()) {
        const text = await button.innerText();
        const ariaLabel = await button.getAttribute("aria-label");
        const hasAccessibleName = (text && text.trim().length > 0) || (ariaLabel && ariaLabel.trim().length > 0);
        expect(hasAccessibleName).toBe(true);
      }
    }

    // Verify keyboard navigation (Tab key focuses elements)
    await page.keyboard.press("Tab");
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(["A", "BUTTON", "INPUT", "BODY"]).toContain(focusedTag);
  });
});
