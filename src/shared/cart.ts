import type { CartItem } from "./types";

/** Operaciones del carrito. Funciones puras: el estado (y su guardado en el navegador) vive en el front. */

export const MAX_QUANTITY = 99;
/** Largo máximo del detalle que escribe el cliente. */
export const MAX_NOTE = 200;

const clamp = (n: number) => Math.max(1, Math.min(MAX_QUANTITY, Math.floor(n)));

/** Identifica una línea del carrito: la variante y, si la personalizó, su detalle (mismo mate con otro grabado = otra línea). */
export const lineKey = (i: Pick<CartItem, "variantId" | "note">): string => (i.note ? `${i.variantId}::${i.note}` : i.variantId);

/** Agrega una variante; si ya estaba, suma la cantidad. */
export function addItem(items: CartItem[], item: Omit<CartItem, "quantity">, quantity = 1): CartItem[] {
  const key = lineKey(item);
  if (items.some((i) => lineKey(i) === key)) {
    return items.map((i) => (lineKey(i) === key ? { ...i, quantity: clamp(i.quantity + quantity) } : i));
  }
  return [...items, { ...item, quantity: clamp(quantity) }];
}

export function setQuantity(items: CartItem[], key: string, quantity: number): CartItem[] {
  if (quantity < 1) return removeItem(items, key);
  return items.map((i) => (lineKey(i) === key ? { ...i, quantity: clamp(quantity) } : i));
}

export function removeItem(items: CartItem[], key: string): CartItem[] {
  return items.filter((i) => lineKey(i) !== key);
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
  ).map((i) => {
    const { note, ...rest } = i;
    const clean = typeof note === "string" ? note.trim().slice(0, MAX_NOTE) : "";
    return { ...rest, quantity: clamp(i.quantity), image: typeof i.image === "string" ? i.image : null, ...(clean ? { note: clean } : {}) };
  });
}
