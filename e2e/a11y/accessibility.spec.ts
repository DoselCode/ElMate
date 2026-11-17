import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin, requireAdmin } from "../support/admin";

// WCAG 2.1 A/AA automated checks (axe-core). Automated tools catch roughly a third of issues;
// keyboard and screen-reader checks stay manual (see docs/qa/reporte-no-funcional-develop.md).
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// Reveal animations (blur + fade) make axe measure contrast mid-transition; the CSS honors reduced motion.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG)
    .exclude('iframe[src*="instagram.com"]') // third-party embed, not under our control
    .analyze();
  return violations.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length}) → ${v.nodes[0]?.target.join(" ")}`);
}

test.describe("Accessibility (WCAG 2.1 AA, axe)", () => {
  for (const [name, path] of [
    ["home", "/"],
    ["shop", "/tienda"],
    ["product", "/producto/aguantadora-tradicional-500-g"],
    ["admin login", "/admin/login"],
  ] as const) {
    test(`${name} has no critical or serious violations @mobile`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const found = await audit(page);
      const blocking = found.filter((v) => v.startsWith("critical") || v.startsWith("serious"));
      expect(blocking, found.join("\n")).toEqual([]);
    });
  }

  test("cart drawer has no critical or serious violations", async ({ page }) => {
    await page.goto("/tienda");
    await page.getByRole("button", { name: /^Ver carrito/ }).click();
    await expect(page.getByText(/tu pedido/i)).toBeVisible();
    const found = await audit(page);
    const blocking = found.filter((v) => v.startsWith("critical") || v.startsWith("serious"));
    expect(blocking, found.join("\n")).toEqual([]);
  });

  test("closing the search panel with Escape returns focus to its toggle", async ({ page }) => {
    await page.goto("/tienda");
    const toggle = page.locator("[data-search-toggle]");
    await toggle.click();
    await expect(page.getByRole("combobox").or(page.getByRole("searchbox")).first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(toggle).toBeFocused();
  });

  for (const path of ["/admin/stock", "/admin/ventas/nueva", "/admin/caja"]) {
    test(`panel ${path} has no critical or serious violations`, async ({ page }) => {
      requireAdmin();
      await loginAsAdmin(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const found = await audit(page);
      const blocking = found.filter((v) => v.startsWith("critical") || v.startsWith("serious"));
      expect(blocking, found.join("\n")).toEqual([]);
    });
  }
});
