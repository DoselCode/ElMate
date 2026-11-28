import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin, requireAdmin, writesAllowed } from "../support/admin";

// Creates real records. Opt in with E2E_ALLOW_WRITES=1, only against a test environment.
test.describe.configure({ mode: "serial" });

test.describe("Stock and sales lifecycle", () => {
  const stamp = Date.now().toString(36).toUpperCase();
  const name = `QA E2E ${stamp}`;
  const sku = `QA-E2E-${stamp}`;

  test.beforeEach(async ({ page }) => {
    requireAdmin();
    test.skip(!writesAllowed, "Set E2E_ALLOW_WRITES=1 to run flows that create data");
    await loginAsAdmin(page);
  });

  async function openRow(page: Page) {
    await page.goto(`/admin/stock?q=${encodeURIComponent(sku)}`);
    await expect(page.getByRole("row").filter({ hasText: sku })).toBeVisible();
  }

  async function rowStock(page: Page): Promise<string> {
    return (await page.getByRole("row").filter({ hasText: sku }).innerText()).replace(/\s+/g, " ");
  }

  test("CU-24 product form validates and creates a product", async ({ page }) => {
    await page.goto("/admin/stock/new");
    await page.getByRole("button", { name: "Crear producto" }).click();
    await expect(page.getByText("El nombre es obligatorio (mínimo 2 caracteres)")).toBeVisible();

    await page.locator("#name").fill(name);
    await page.locator("#category").selectOption({ label: "Mates" });
    await page.locator('input[id$="-sku"]').fill(sku);
    await page.locator('input[id$="-cost"]').fill("1000");
    await page.locator('input[id$="-margin"]').fill("50");
    await expect(page.getByText("$2.500").first()).toBeVisible(); // 1000 / (1 - 0.5) = 2000 cash, / 0.8 = 2500 list
    await page.getByRole("button", { name: "Crear producto" }).click();

    await expect(page).toHaveURL(/saved=1/);
    await expect(page.getByText("Producto guardado correctamente.")).toBeVisible();
  });

  test("CU-26 / CU-27 / CU-28 stock in, adjustment with reason and movement history", async ({ page }) => {
    await openRow(page);

    await page.getByRole("button", { name: `Registrar ingreso de ${name}` }).click();
    const stockIn = page.getByRole("dialog");
    await stockIn.getByLabel("Cantidad que ingresa").fill("0");
    await stockIn.getByRole("button", { name: "Registrar ingreso" }).click();
    await expect(stockIn.getByText("Tiene que ser mayor a 0")).toBeVisible();
    await stockIn.getByLabel("Cantidad que ingresa").fill("10");
    await stockIn.getByRole("button", { name: "Registrar ingreso" }).click();
    await expect(page.getByText(`Ingreso registrado: +10 · ${name}`)).toBeVisible();

    await page.getByRole("button", { name: `Ajustar stock de ${name}` }).click();
    const adjust = page.getByRole("dialog");
    await adjust.getByText("Sumar / restar").click();
    await adjust.getByLabel("Cantidad (negativa para restar)").fill("-1");
    await adjust.getByRole("button", { name: "Guardar ajuste" }).click();
    await expect(adjust.getByText("Indicá el motivo (ej: rotura, faltante)")).toBeVisible();
    await adjust.getByLabel("Motivo").fill("QA E2E rotura");
    await adjust.getByRole("button", { name: "Guardar ajuste" }).click();
    await expect(page.getByText(`Stock ajustado −1 · ${name}`)).toBeVisible();
    expect(await rowStock(page)).toMatch(/\$1\.000 9 /);

    await page.goto(`/admin/stock/movements?q=${encodeURIComponent(sku)}`);
    const rows = page.getByRole("row").filter({ hasText: sku });
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText("Ajuste");
    await expect(rows.first()).toContainText("QA E2E rotura");
    await expect(rows.nth(1)).toContainText("Ingreso");
  });

  test("CU-30 / CU-32 sells by transfer, prints the ticket and voids it", async ({ page }) => {
    await page.goto("/admin/caja");
    test.skip(!(await page.getByRole("button", { name: "Cerrar caja" }).count()), "No open cash session");

    await page.goto("/admin/ventas/nueva");
    await page.getByPlaceholder(/Buscá por nombre o código/).fill(sku);
    await page.getByRole("button", { name: `Agregar ${name} al carrito` }).click();
    await page.getByRole("button", { name: `Sumar uno de ${name}` }).click();
    await page.getByText("Transferencia", { exact: true }).click();
    await page.getByRole("button", { name: "Cobrar $4.250" }).click(); // 2 × 2500 − 15 %

    const done = page.getByRole("dialog");
    await expect(done).toContainText("registrada · $4.250");
    await done.getByRole("link", { name: "Ver ticket" }).click();
    await expect(page.getByText("DOCUMENTO NO VÁLIDO COMO FACTURA")).toBeVisible();
    await expect(page.getByText(`2 × $2.500`)).toBeVisible();

    await page.getByRole("button", { name: "Anular" }).click();
    const voidDialog = page.getByRole("dialog");
    await voidDialog.getByRole("button", { name: "Anular venta" }).click();
    await expect(voidDialog.getByText("Indicá el motivo")).toBeVisible();
    await voidDialog.getByLabel("Motivo").fill("QA E2E anulación");
    await voidDialog.getByRole("button", { name: "Anular venta" }).click();
    await expect(page.getByText(/Venta anulada: QA E2E anulación/)).toBeVisible();

    await openRow(page);
    expect(await rowStock(page)).toMatch(/\$1\.000 9 /);
  });

  test("CU-25 hiding the product removes it from the public shop", async ({ page }) => {
    await openRow(page);
    await page.getByRole("link", { name: `Editar ${name}` }).click();
    await page.getByText("Visible en la tienda").click();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Producto guardado correctamente.")).toBeVisible();

    await page.goto(`/tienda?q=${encodeURIComponent(name)}`);
    await expect(page.getByText(/^0 productos para/)).toBeVisible();
  });

  test("BUG-05 creating a product with an automatic SKU succeeds", async ({ page }) => {
    await page.goto("/admin/stock/new");
    await page.locator("#name").fill(`${name} auto SKU`);
    await page.locator('input[id$="-cost"]').fill("1000");
    await page.locator('input[id$="-margin"]').fill("50");
    await page.getByText("Visible en la tienda").click();
    await page.getByRole("button", { name: "Crear producto" }).click();
    await expect(page.getByText("Ya existe una variante con ese código (SKU).")).toHaveCount(0);
    await expect(page).toHaveURL(/saved=1/);
  });
});
