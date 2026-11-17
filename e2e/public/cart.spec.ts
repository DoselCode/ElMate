import { expect, test } from "@playwright/test";
import { clearCart, firstInStockProduct, parseMoney } from "../support/shop";

test.describe("Cart and WhatsApp order", () => {
  test.beforeEach(async ({ page }) => {
    await clearCart(page);
  });

  test("CU-09 / CU-10 / CU-11 / CU-12 adds, edits, persists and sends the order @mobile", async ({ page }) => {
    const product = await firstInStockProduct(page);
    await page.goto(`/producto/${product.slug}`);
    const unitPrice = parseMoney(await page.locator("main p.font-display").first().innerText());

    await page.getByRole("button", { name: "Sumar uno" }).click();
    await page.getByRole("button", { name: "Agregar al carrito" }).click();
    await expect(page.getByRole("button", { name: /Ver carrito, 2 productos/ })).toBeVisible();

    // CU-12: survives a reload.
    await page.reload();
    const cartButton = page.getByRole("button", { name: /Ver carrito, 2 productos/ });
    await expect(cartButton).toBeVisible();
    await cartButton.click();

    const send = page.getByRole("link", { name: "Enviar pedido por WhatsApp" });
    await expect(send).toBeVisible();
    const href = decodeURIComponent((await send.getAttribute("href")) ?? "");
    expect(href).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(href).toContain(`2 × ${product.name}`);
    expect(href).toContain("Total estimado:");
    const total = parseMoney(href.split("Total estimado:")[1]);
    expect(total).toBeCloseTo(unitPrice * 2, 2);

    await page.getByLabel("Tu nombre (opcional)").fill("QA E2E");
    await expect(send).toHaveAttribute("href", /Nombre%3A%20QA%20E2E/);

    // CU-10: removing the only item empties the cart and hides the send action.
    await page.getByRole("button", { name: `Quitar ${product.name} del carrito` }).click();
    await expect(page.getByText("Tu carrito está vacío")).toBeVisible();
    await expect(send).toHaveCount(0);
  });

  test("CU-13 out-of-stock products cannot be added", async ({ page }) => {
    await page.goto("/tienda");
    const outOfStock = page.locator("main article").filter({ hasText: "Sin stock" }).first();
    test.skip((await outOfStock.count()) === 0, "No out-of-stock product on the first page");
    await outOfStock.locator("h3 a").click();
    await expect(page.getByRole("button", { name: "Agregar al carrito" })).toBeDisabled();
  });
});
