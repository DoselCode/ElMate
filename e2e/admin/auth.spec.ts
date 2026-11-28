import { expect, test } from "@playwright/test";

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.describe("Admin authentication", () => {
  test("CU-22 protected routes redirect to login without a session", async ({ page }) => {
    for (const path of ["/admin", "/admin/stock", "/admin/ventas", "/admin/caja"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/admin\/login/);
    }
  });

  test("CU-21 rejects wrong credentials", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill("qa-e2e-no-existe@example.com");
    await page.getByLabel("Contraseña").fill("wrong-password-e2e");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByText("Email o contraseña incorrectos")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("CU-20 logs in with valid credentials", async ({ page }) => {
    test.skip(!email || !password, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD in .env.local");
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Contraseña").fill(password!);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/admin\/stock/);
  });
});
