import type { CartItem } from "./types";

/** Operaciones del carrito. Funciones puras: el estado (y su guardado en el navegador) vive en el front. */

export const MAX_QUANTITY = 99;
/** Largo máximo del detalle que escribe el cliente. */
export const MAX_NOTE = 200;

const clamp = (n: number, max = MAX_QUANTITY) => Math.max(1, Math.min(max, MAX_QUANTITY, Math.floor(n)));

/** Cuánto hay de una variante en el carrito, sumando todas sus líneas (con distintos detalles). */
export function variantQuantity(items: CartItem[], variantId: string, exceptKey?: string): number {
  return items.reduce((n, i) => (i.variantId === variantId && lineKey(i) !== exceptKey ? n + i.quantity : n), 0);
}

/**
 * Cuánto más se puede sumar de una variante: su tope por stock (o MAX_QUANTITY) menos lo que ya está
 * en el carrito. `exceptKey` deja afuera una línea (la que se está editando).
 */
export function remainingFor(items: CartItem[], variantId: string, max: number | null | undefined, exceptKey?: string): number {
  return Math.max(0, Math.min(max ?? MAX_QUANTITY, MAX_QUANTITY) - variantQuantity(items, variantId, exceptKey));
}

/** Identifica una línea del carrito: la variante y, si la personalizó, su detalle (mismo mate con otro grabado = otra línea). */
export const lineKey = (i: Pick<CartItem, "variantId" | "note">): string => (i.note ? `${i.variantId}::${i.note}` : i.variantId);

/** Agrega una variante; si ya estaba, suma la cantidad. Nunca pasa del tope por stock de la variante. */
export function addItem(items: CartItem[], item: Omit<CartItem, "quantity">, quantity = 1): CartItem[] {
  const key = lineKey(item);
  const existing = items.find((i) => lineKey(i) === key);
  const room = remainingFor(items, item.variantId, item.max ?? existing?.max, key);
  if (room <= 0) return items;
  if (existing) {
    return items.map((i) => (i === existing ? { ...i, ...withMax(item.max), quantity: clamp(i.quantity + quantity, room) } : i));
  }
  return [...items, { ...item, quantity: clamp(quantity, room) }];
}

export function setQuantity(items: CartItem[], key: string, quantity: number): CartItem[] {
  if (quantity < 1) return removeItem(items, key);
  return items.map((i) => (lineKey(i) === key ? { ...i, quantity: clamp(quantity, Math.max(1, remainingFor(items, i.variantId, i.max, key))) } : i));
}

const withMax = (max: number | undefined) => (max !== undefined ? { max } : {});

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
    const { note, max, ...rest } = i;
    const clean = typeof note === "string" ? note.trim().slice(0, MAX_NOTE) : "";
    const cap = typeof max === "number" && Number.isInteger(max) && max >= 1 ? Math.min(max, MAX_QUANTITY) : undefined;
    return {
      ...rest,
      quantity: clamp(i.quantity, cap),
      image: typeof i.image === "string" ? i.image : null,
      ...(clean ? { note: clean } : {}),
      ...withMax(cap),
    };
  });
}
