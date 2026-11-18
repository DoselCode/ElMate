import { expect, test } from "@playwright/test";
import { cardPrice, filtersPanel, productCards, shopTotal } from "../support/shop";

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
    expect(await shopTotal(page)).toBeGreaterThan(0);
  });

  test("CU-03 filters by category", async ({ page }) => {
    await page.goto("/tienda");
    await filtersPanel(page).getByRole("link", { name: /^Yerbas \(\d+\)$/ }).click();
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

  test("CU-15 filters by brand from the sidebar and removes it with its chip", async ({ page }) => {
    await page.goto("/tienda");
    const before = await shopTotal(page);
    const panel = filtersPanel(page);
    await panel.getByText("Marca", { exact: true }).click();
    const brand = panel.getByRole("checkbox").first();
    const label = (await brand.locator("xpath=..").innerText()).replace(/\s*\(\d+\)\s*$/, "").trim();
    // El checkbox refleja la URL: se marca cuando termina la navegación
    await brand.click();
    await expect(page).toHaveURL(/marca=/);
    await expect(brand).toBeChecked();
    const chip = page.getByRole("button", { name: `Quitar filtro ${label}` });
    await expect(chip).toBeVisible();
    expect(await shopTotal(page)).toBeLessThanOrEqual(before);

    await chip.click();
    await expect(page).not.toHaveURL(/marca=/);
    await expect.poll(() => shopTotal(page)).toBe(before);
  });

  test("CU-16 legacy links keep working", async ({ page }) => {
    await page.goto("/tienda?categoria=yerbas");
    await expect(productCards(page).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Quitar filtro Yerbas/ })).toBeVisible();

    await page.goto("/tienda?ofertas=1");
    await expect(productCards(page).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Quitar filtro Solo ofertas" })).toBeVisible();
  });

  test("CU-17 an empty result keeps the selection and offers to clear everything", async ({ page }) => {
    await page.goto("/tienda?ofertas=1&precio=999999999-");
    await expect(page.getByText("No encontramos productos con esos filtros")).toBeVisible();
    await expect(filtersPanel(page).getByRole("checkbox", { name: /Solo ofertas/ })).toBeChecked();
    await page.getByRole("button", { name: "Limpiar todo" }).click();
    await expect(page).toHaveURL(/\/tienda$/);
    await expect(productCards(page).first()).toBeVisible();
  });

  test("CU-18 invalid filter params do not break the page", async ({ page }) => {
    const response = await page.goto("/tienda?precio=abc&marca=,,&color=%3Cscript%3E&Precio=1");
    expect(response?.status()).toBe(200);
    await expect(productCards(page).first()).toBeVisible();
  });

  test("CU-19 mobile filters panel closes with Escape and returns focus @mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "The panel only exists on small screens");
    await page.goto("/tienda");
    const opener = page.getByRole("button", { name: /^Filtros/ });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Filtros" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("CU-20 typing a multi-word search keeps focus and every character", async ({ page }) => {
    await page.goto("/tienda");
    const box = page.getByRole("main").getByRole("searchbox", { name: "Buscar productos" });
    await box.click();
    await box.pressSequentially("mate de", { delay: 150 });
    await page.waitForTimeout(600); // la URL ya cambió con "mate de"
    await box.pressSequentially(" calabaza", { delay: 150 });
    await expect(box).toBeFocused();
    await expect(box).toHaveValue("mate de calabaza");
    await expect(page).toHaveURL(/q=mate\+de\+calabaza|q=mate%20de%20calabaza/);
  });

  test("CU-21 tabbing from minimum to maximum price keeps the maximum field usable", async ({ page }) => {
    await page.goto("/tienda");
    const panel = filtersPanel(page);
    await panel.getByText("Precio", { exact: true }).click();
    await panel.getByLabel("Precio mínimo").fill("5000");
    await page.keyboard.press("Tab");
    await expect(page).toHaveURL(/precio=5000-/);
    const max = panel.getByLabel("Precio máximo");
    await expect(max).toBeFocused();
    await page.keyboard.type("90000");
    await expect(max).toHaveValue("90000");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/precio=5000-90000/);
  });

  test("CU-22 unknown query params (marketing links) do not filter the store", async ({ page }) => {
    await page.goto("/tienda");
    const total = await shopTotal(page);
    await page.goto("/tienda?ref=instagram&utm_source=ig&si=abc");
    await expect(productCards(page).first()).toBeVisible();
    expect(await shopTotal(page)).toBe(total);
    await expect(page.getByRole("button", { name: /^Quitar filtro/ })).toHaveCount(0);
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
