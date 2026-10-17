import type { CartItem } from "./types";

/** Operaciones del carrito. Funciones puras: el estado (y su guardado en el navegador) vive en el front. */

export const MAX_QUANTITY = 99;

const clamp = (n: number) => Math.max(1, Math.min(MAX_QUANTITY, Math.floor(n)));

/** Agrega una variante; si ya estaba, suma la cantidad. */
export function addItem(items: CartItem[], item: Omit<CartItem, "quantity">, quantity = 1): CartItem[] {
  const existing = items.find((i) => i.variantId === item.variantId);
  if (existing) {
    return items.map((i) => (i.variantId === item.variantId ? { ...i, quantity: clamp(i.quantity + quantity) } : i));
  }
  return [...items, { ...item, quantity: clamp(quantity) }];
}

export function setQuantity(items: CartItem[], variantId: string, quantity: number): CartItem[] {
  if (quantity < 1) return removeItem(items, variantId);
  return items.map((i) => (i.variantId === variantId ? { ...i, quantity: clamp(quantity) } : i));
}

export function removeItem(items: CartItem[], variantId: string): CartItem[] {
  return items.filter((i) => i.variantId !== variantId);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((n, i) => n + i.quantity, 0);
}

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}

/** Valida lo leído del navegador (puede venir corrupto o de una versión vieja): descarta lo inválido. */
export function sanitizeCart(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (i): i is CartItem =>
      typeof i === "object" &&
      i !== null &&
      typeof i.variantId === "string" &&
      typeof i.productId === "string" &&
      typeof i.slug === "string" &&
      typeof i.name === "string" &&
      typeof i.variantLabel === "string" &&
      typeof i.price === "number" &&
      Number.isFinite(i.price) &&
      typeof i.quantity === "number" &&
      i.quantity >= 1,
  ).map((i) => ({ ...i, quantity: clamp(i.quantity), image: typeof i.image === "string" ? i.image : null }));
}
