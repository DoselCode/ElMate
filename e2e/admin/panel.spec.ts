import { expect, test } from "@playwright/test";
import { loginAsAdmin, requireAdmin } from "../support/admin";

// Read-only: visits every panel screen and checks it renders.
test.describe("Admin panel screens", () => {
  test.beforeEach(async ({ page }) => {
    requireAdmin();
    await loginAsAdmin(page);
  });

  const screens = [
    ["/admin/stock", /inventario y stock/i],
    ["/admin/stock/movements", /movimientos/i],
    ["/admin/ventas", /ventas/i],
    ["/admin/ventas/nueva", /nueva venta/i],
    ["/admin/caja", /caja/i],
    ["/admin/promociones", /promociones/i],
    ["/admin/ingresos", /ingresos/i],
    ["/admin/local", /datos del local|local/i],
  ] as const;

  for (const [path, heading] of screens) {
    test(`CU-23/28/36 renders ${path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText(heading);
      expect(errors).toEqual([]);
    });
  }

  test("CU-23 inventory shows costs to the admin", async ({ page }) => {
    await page.goto("/admin/stock");
    await expect(page.getByRole("columnheader", { name: "Costo" })).toBeVisible();
  });
});
