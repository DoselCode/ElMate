import { describe, expect, it } from "vitest";
import { addItem, cartCount, cartTotal, MAX_QUANTITY, removeItem, sanitizeCart, setQuantity } from "./cart";
import { buildOrderMessage, normalizeWhatsappNumber, whatsappLink } from "./whatsapp";
import type { CartItem } from "./types";

const mate = { variantId: "v1", productId: "p1", slug: "mate", name: "Mate Imperial", variantLabel: "Negro / Grande", price: 18500, image: null };
const termo = { variantId: "v2", productId: "p2", slug: "termo", name: "Termo 1L", variantLabel: "", price: 42000, image: null };

describe("carrito", () => {
  it("agrega, suma cantidades de la misma variante y calcula totales", () => {
    let items: CartItem[] = [];
    items = addItem(items, mate);
    items = addItem(items, mate, 2);
    items = addItem(items, termo);
    expect(items).toHaveLength(2);
    expect(items[0].quantity).toBe(3);
    expect(cartCount(items)).toBe(4);
    expect(cartTotal(items)).toBe(3 * 18500 + 42000);
  });

  it("limita la cantidad y quita el ítem al bajar de 1", () => {
    let items = addItem([], mate, 500);
    expect(items[0].quantity).toBe(MAX_QUANTITY);
    items = setQuantity(items, "v1", 0);
    expect(items).toEqual([]);
    expect(removeItem(addItem([], termo), "v2")).toEqual([]);
  });

  it("descarta datos corruptos guardados en el navegador", () => {
    expect(sanitizeCart("basura")).toEqual([]);
    expect(sanitizeCart([{ ...mate, quantity: 2 }, { variantId: 3 }, { ...termo, price: "caro", quantity: 1 }])).toEqual([
      { ...mate, quantity: 2 },
    ]);
  });
});

describe("WhatsApp", () => {
  it("normaliza números argentinos cargados de distintas formas", () => {
    expect(normalizeWhatsappNumber("+54 9 11 5555-1234")).toBe("5491155551234");
    expect(normalizeWhatsappNumber("+54 11 5555-1234")).toBe("5491155551234");
    expect(normalizeWhatsappNumber("011 15 5555-1234")).toBe("5491155551234");
    expect(normalizeWhatsappNumber("11 5555-1234")).toBe("5491155551234");
    expect(normalizeWhatsappNumber("0341 15 512-3456")).toBe("5493415123456");
    expect(normalizeWhatsappNumber("3415123456")).toBe("5493415123456");
    expect(normalizeWhatsappNumber("")).toBeNull();
    expect(normalizeWhatsappNumber("1234")).toBeNull();
  });

  it("arma el mensaje del pedido con ítems, total, nombre y nota", () => {
    const items = addItem(addItem([], mate, 2), termo);
    const text = buildOrderMessage(items, { storeName: "El Mate", customerName: " Juan ", notes: "Retiro el sábado" });
    expect(text).toContain("¡Hola El Mate! Quiero hacer este pedido:");
    expect(text).toContain("• 2 × Mate Imperial (Negro / Grande) — $");
    expect(text).toContain("• 1 × Termo 1L — $");
    expect(text).toMatch(/Total estimado: \$\s?79\.000/);
    expect(text).toContain("Nombre: Juan");
    expect(text).toContain("Nota: Retiro el sábado");
    expect(buildOrderMessage(items, { storeName: "El Mate" })).not.toContain("Nombre:");
  });

  it("codifica el texto en el link", () => {
    expect(whatsappLink("5491155551234", "Hola & chau")).toBe("https://wa.me/5491155551234?text=Hola%20%26%20chau");
  });
});
