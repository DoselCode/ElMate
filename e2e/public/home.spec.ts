import { expect, test } from "@playwright/test";

test.describe("CU-01 Home", () => {
  test("renders the main sections without page errors @mobile", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/El Mate/);
    await expect(page.getByRole("link", { name: "Ver tienda" })).toBeVisible();
    await expect(page.getByText(/productos destacados/i)).toBeVisible();
    await expect(page.getByText(/categorías de productos/i)).toBeVisible();

    const noHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(noHorizontalScroll).toBe(true);
    expect(pageErrors).toEqual([]);
  });

  test("discount badges never show 100% or more", async ({ page }) => {
    await page.goto("/");
    const badges = await page.locator("main span", { hasText: /^-\d+%/ }).allInnerTexts();
    for (const badge of badges) {
      const pct = Number(badge.match(/-(\d+)%/)?.[1]);
      expect(pct, `badge "${badge}"`).toBeLessThan(100);
    }
  });
});
