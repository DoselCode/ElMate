import { describe, expect, it } from "vitest";
import { fieldErrors, productSchema, toSavePayload, type ProductInput } from "./product";
import { stockAdjustSchema, stockInSchema } from "./stock";
import { slugify } from "../slug";

const variant = (over: Record<string, unknown> = {}) => ({
  sku: "",
  barcode: "",
  attributes: { Color: "Negro" },
  price: 1000,
  cost: 500,
  minStock: 0,
  initialStock: 0,
  active: true,
  ...over,
});

const base = (over: Partial<ProductInput> = {}): ProductInput => ({
  name: "Mate Imperial",
  description: "",
  categoryId: null,
  supplierId: null,
  optionNames: ["Color"],
  images: [],
  isVisible: true,
  badge: "",
  variants: [variant()],
  ...over,
});

describe("productSchema", () => {
  it("acepta un producto válido", () => {
    expect(productSchema.safeParse(base()).success).toBe(true);
  });

  it("exige nombre y al menos una variante", () => {
    const r = productSchema.safeParse(base({ name: " a ", variants: [] }));
    expect(r.success).toBe(false);
    if (!r.success) {
      const errs = fieldErrors(r.error);
      expect(errs.name).toMatch(/obligatorio/);
      expect(errs.variants).toMatch(/al menos una/);
    }
  });

  it("sin opciones solo permite una variante", () => {
    const r = productSchema.safeParse(base({ optionNames: [], variants: [variant({ attributes: {} }), variant({ attributes: {}, sku: "B" })] }));
    expect(r.success).toBe(false);
    expect(productSchema.safeParse(base({ optionNames: [], variants: [variant({ attributes: {} })] })).success).toBe(true);
  });

  it("pide un valor por cada opción y detecta combinaciones repetidas", () => {
    const r = productSchema.safeParse(
      base({
        optionNames: ["Color", "Tamaño"],
        variants: [
          variant({ attributes: { Color: "Negro", Tamaño: "G" } }),
          variant({ attributes: { Color: "negro", Tamaño: " g " }, sku: "X" }),
          variant({ attributes: { Color: "Rojo" }, sku: "Y" }),
        ],
      }),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      const errs = fieldErrors(r.error);
      expect(errs["variants.1.attributes"]).toMatch(/ya está cargada/);
      expect(errs["variants.2.attributes.Tamaño"]).toMatch(/Completá Tamaño/);
    }
  });

  it("detecta SKU repetido sin importar mayúsculas y permite varios vacíos", () => {
    const dup = productSchema.safeParse(
      base({ variants: [variant({ sku: "abc" }), variant({ sku: "ABC", attributes: { Color: "Rojo" } })] }),
    );
    expect(dup.success).toBe(false);
    const blanks = productSchema.safeParse(base({ variants: [variant(), variant({ attributes: { Color: "Rojo" } })] }));
    expect(blanks.success).toBe(true);
  });

  it("rechaza precios negativos y NaN (campo vacío en el formulario)", () => {
    const r = productSchema.safeParse(base({ variants: [variant({ price: -1, cost: Number.NaN })] }));
    expect(r.success).toBe(false);
    if (!r.success) {
      const errs = fieldErrors(r.error);
      expect(errs["variants.0.price"]).toMatch(/negativo/);
      expect(errs["variants.0.cost"]).toBeTruthy();
    }
  });

  it("limita a 3 opciones y detecta opciones repetidas", () => {
    expect(productSchema.safeParse(base({ optionNames: ["a", "b", "c", "d"] })).success).toBe(false);
    expect(productSchema.safeParse(base({ optionNames: ["Color", "color"] })).success).toBe(false);
  });
});

describe("toSavePayload", () => {
  it("solo manda los ejes vigentes y el stock inicial únicamente en variantes nuevas", () => {
    const parsed = productSchema.parse(
      base({
        id: "11111111-1111-4111-8111-111111111111",
        optionNames: ["Color"],
        badge: "",
        variants: [
          variant({ id: "22222222-2222-4222-8222-222222222222", attributes: { Color: " Negro ", Tamaño: "viejo" }, initialStock: 9 }),
          variant({ attributes: { Color: "Rojo" }, initialStock: 4 }),
        ],
      }),
    );
    const payload = toSavePayload(parsed, "mate-imperial");
    expect(payload.slug).toBe("mate-imperial");
    expect(payload.badge).toBeNull();
    expect(payload.variants[0].attributes).toEqual({ Color: "Negro" });
    expect(payload.variants[0]).not.toHaveProperty("initial_stock");
    expect(payload.variants[1]).toMatchObject({ id: null, initial_stock: 4, attributes: { Color: "Rojo" } });
  });
});

describe("stock schemas", () => {
  const id = "11111111-1111-4111-8111-111111111111";

  it("el ingreso exige cantidad entera positiva", () => {
    expect(stockInSchema.safeParse({ variantId: id, quantity: 5, unitCost: null, reason: "" }).success).toBe(true);
    expect(stockInSchema.safeParse({ variantId: id, quantity: 0, unitCost: null, reason: "" }).success).toBe(false);
    expect(stockInSchema.safeParse({ variantId: id, quantity: 1.5, unitCost: null, reason: "" }).success).toBe(false);
    expect(stockInSchema.safeParse({ variantId: id, quantity: 1, unitCost: -3, reason: "" }).success).toBe(false);
  });

  it("el ajuste por diferencia exige motivo y no admite 0; el recuento admite 0 sin motivo", () => {
    expect(stockAdjustSchema.safeParse({ mode: "delta", variantId: id, delta: -2, reason: "Rotura" }).success).toBe(true);
    expect(stockAdjustSchema.safeParse({ mode: "delta", variantId: id, delta: -2, reason: " " }).success).toBe(false);
    expect(stockAdjustSchema.safeParse({ mode: "delta", variantId: id, delta: 0, reason: "Rotura" }).success).toBe(false);
    expect(stockAdjustSchema.safeParse({ mode: "count", variantId: id, counted: 0, reason: "" }).success).toBe(true);
    expect(stockAdjustSchema.safeParse({ mode: "count", variantId: id, counted: -1, reason: "" }).success).toBe(false);
  });
});

describe("slugify", () => {
  it("quita tildes y símbolos", () => {
    expect(slugify("Mate Imperial 'Premium' ñandú")).toBe("mate-imperial-premium-nandu");
    expect(slugify("  --  ")).toBe("");
  });
});
