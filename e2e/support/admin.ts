import { expect, test, type Page } from "@playwright/test";

export const adminEmail = process.env.E2E_ADMIN_EMAIL;
export const adminPassword = process.env.E2E_ADMIN_PASSWORD;
export const hasAdminCredentials = Boolean(adminEmail && adminPassword);

/** Write flows create records (products, stock movements, sales); they only run when explicitly allowed. */
export const writesAllowed = process.env.E2E_ALLOW_WRITES === "1";

export function requireAdmin(): void {
  test.skip(!hasAdminCredentials, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD in .env.local");
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(adminEmail!);
  await page.getByLabel("Contraseña").fill(adminPassword!);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/admin\/stock/);
}
