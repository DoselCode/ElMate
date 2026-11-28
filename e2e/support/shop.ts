import { expect, type Locator, type Page } from "@playwright/test";

/** Parses an Argentine price like "$4.587,50" into 4587.5. */
export function parseMoney(text: string): number {
  const match = text.match(/\$\s*([\d.]+(?:,\d+)?)/);
  if (!match) throw new Error(`No price found in "${text}"`);
  return Number(match[1].replace(/\./g, "").replace(",", "."));
}

/** Sidebar of shop filters (desktop) or the open mobile panel. */
export function filtersPanel(page: Page): Locator {
  return page.getByRole("navigation", { name: "Filtros" }).filter({ visible: true });
}

/** Total shown next to the shop title: "Tienda (12)" -> 12. */
export async function shopTotal(page: Page): Promise<number> {
  const text = await page.getByRole("heading", { level: 1 }).innerText();
  const match = text.match(/\((\d+)\)/);
  if (!match) throw new Error(`No total in "${text}"`);
  return Number(match[1]);
}

export function productCards(page: Page): Locator {
  return page.locator("main article").filter({ has: page.locator('h3 a[href^="/producto/"]') });
}

/** Current price of a card: the "Ahora" price when on sale, otherwise the only price. */
export async function cardPrice(card: Locator): Promise<number> {
  const prices = await card.locator("p.font-display").allInnerTexts();
  return parseMoney(prices[prices.length - 1]);
}

/** Opens the shop and returns the slug of the first product that can be added to the cart. */
export async function firstInStockProduct(page: Page): Promise<{ slug: string; name: string; price: number }> {
  await page.goto("/tienda");
  const cards = productCards(page);
  await expect(cards.first()).toBeVisible();
  const count = await cards.count();
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    if (await card.getByText("Sin stock").count()) continue;
    const link = card.locator('h3 a[href^="/producto/"]');
    const href = (await link.getAttribute("href")) ?? "";
    return { slug: href.replace("/producto/", ""), name: (await link.innerText()).trim(), price: await cardPrice(card) };
  }
  throw new Error("No in-stock product on the first shop page");
}

export async function clearCart(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) if (/cart|carrito/i.test(key)) localStorage.removeItem(key);
  });
}
