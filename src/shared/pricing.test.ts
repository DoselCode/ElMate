import { describe, expect, it } from "vitest";
import { applyAdjustment, marginOf, priceFromCost } from "./pricing";
import { formatQuantity, parseDecimal } from "./format";

describe("precios de la lista del local", () => {
  it("calcula efectivo y lista igual que el Excel", () => {
    // COM001: costo 35.300, ganancia 53 % → efectivo $75.110, lista $93.887,50
    expect(priceFromCost(35300, 53, -20)).toEqual({ cashPrice: 75110, listPrice: 93887.5 });
    // ACC001: costo 5.300, ganancia 60 % → $13.250 / $16.562,50
    expect(priceFromCost(5300, 60, -20)).toEqual({ cashPrice: 13250, listPrice: 16562.5 });
    // MAT004: costo 19.057,50, ganancia 42 % → $32.860 / $41.075
    expect(priceFromCost(19057.5, 42, -20)).toEqual({ cashPrice: 32860, listPrice: 41075 });
  });

  it("no calcula sin costo o con ganancia inválida", () => {
    expect(priceFromCost(0, 50, -20)).toBeNull();
    expect(priceFromCost(1000, 100, -20)).toBeNull();
    expect(priceFromCost(1000, -1, -20)).toBeNull();
  });

  it("cada forma de pago ajusta sobre la lista", () => {
    expect(applyAdjustment(93887.5, -20)).toBe(75110);
    expect(applyAdjustment(93887.5, -15)).toBe(79804.38);
    expect(applyAdjustment(93887.5, -10)).toBe(84498.75);
    expect(applyAdjustment(93887.5, 0)).toBe(93887.5);
  });

  it("calcula la ganancia real de un precio puesto a mano", () => {
    expect(marginOf(93887.5, 35300, -20)).toBe(53);
    expect(marginOf(0, 100, -20)).toBeNull();
  });
});

describe("cantidades", () => {
  it("muestra unidades enteras y kg con hasta 3 decimales", () => {
    expect(formatQuantity(3, "unidad")).toBe("3");
    expect(formatQuantity(0.25, "kg")).toBe("0,25 kg");
    expect(formatQuantity(7.125, "kg")).toBe("7,125 kg");
    expect(formatQuantity(-2, "kg", { signed: true })).toBe("−2 kg");
    expect(formatQuantity(5, "unidad", { signed: true })).toBe("+5");
  });

  it("lee números con coma o punto decimal", () => {
    expect(parseDecimal("0,25")).toBe(0.25);
    expect(parseDecimal("1.5")).toBe(1.5);
    expect(parseDecimal(" 12 ")).toBe(12);
    expect(parseDecimal("")).toBeNaN();
    expect(parseDecimal("abc")).toBeNaN();
  });
});

describe("fechas", () => {
  it("formatea en hora argentina, 24 h y con espacios comunes", async () => {
    const { formatDateTime } = await import("./format");
    const text = formatDateTime("2026-10-18T21:05:00Z");
    expect(text).toBe("18/10/2026, 18:05");
    expect(text).not.toMatch(/[\u202f\u00a0]/);
  });
});
