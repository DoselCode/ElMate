import { expect, test } from "@playwright/test";
import { cardPrice, productCards } from "../support/shop";

test.describe("Shop", () => {
  test("CU-02 navigates from the header to the product list @mobile", async ({ page, isMobile }) => {
    await page.goto("/");
    if (isMobile) {
      await page.goto("/tienda");
    } else {
      await page.getByRole("banner").getByRole("link", { name: "Tienda" }).click();
    }
    await expect(page).toHaveURL(/\/tienda/);
    await expect(productCards(page).first()).toBeVisible();
    await expect(page.getByText(/\d+ productos?/).first()).toBeVisible();
  });

  test("CU-03 filters by category", async ({ page }) => {
    await page.goto("/tienda");
    await page.getByRole("link", { name: "Yerbas", exact: true }).first().click();
    await expect(page).toHaveURL(/categoria=yerbas/);
    const cards = productCards(page);
    await expect(cards.first()).toBeVisible();
    for (const category of await cards.locator("p.uppercase").allInnerTexts()) {
      expect(category.toLowerCase()).toBe("yerbas");
    }
  });

  for (const [option, direction] of [
    ["precio-asc", 1],
    ["precio-desc", -1],
  ] as const) {
    test(`CU-04 sorts by price (${option})`, async ({ page }) => {
      await page.goto("/tienda");
      await page.getByLabel("Ordenar por").selectOption(option);
      await expect(page).toHaveURL(new RegExp(`orden=${option}`));
      const cards = productCards(page);
      await expect(cards.first()).toBeVisible();
      const prices: number[] = [];
      for (let i = 0; i < (await cards.count()); i++) prices.push(await cardPrice(cards.nth(i)));
      const sorted = [...prices].sort((a, b) => (a - b) * direction);
      expect(prices).toEqual(sorted);
    });
  }

  test("CU-05 shows only discounted products with the offers filter", async ({ page }) => {
    await page.goto("/tienda?ofertas=1");
    const cards = productCards(page);
    await expect(cards.first()).toBeVisible();
    for (let i = 0; i < (await cards.count()); i++) {
      await expect(cards.nth(i).locator("p.line-through")).toHaveCount(1);
    }
  });

  test("CU-06 searches products and shows an empty state", async ({ page }) => {
    await page.goto("/tienda");
    const firstName = (await productCards(page).first().locator("h3").innerText()).trim();
    const term = firstName.split(/\s+/)[0];

    await page.getByRole("main").getByRole("searchbox", { name: "Buscar productos" }).fill(term);
    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(term)}`));
    const names = await productCards(page).locator("h3").allInnerTexts();
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(name.toLowerCase()).toContain(term.toLowerCase());

    await page.goto("/tienda?q=zzzxxxnoexiste");
    await expect(page.getByText("No encontramos productos con esos filtros")).toBeVisible();
  });

  test("CU-07 opens a product page with prices per payment method", async ({ page }) => {
    await page.goto("/tienda");
    const link = productCards(page).first().locator("h3 a");
    const name = (await link.innerText()).trim();
    await link.click();
    await expect(page).toHaveURL(/\/producto\//);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(new RegExp(name, "i"));
    await expect(page.getByText(/Efectivo/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Agregar al carrito" })).toBeVisible();
  });

  test("CU-14 unknown product returns 404", async ({ page }) => {
    const response = await page.goto("/producto/no-existe-qa-e2e");
    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle(/no encontrado/i);
  });
});
