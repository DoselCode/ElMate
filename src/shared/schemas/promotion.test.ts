import { describe, expect, it } from "vitest";
import { isoToLocal, localToIso, promotionSchema, toPromotionPayload } from "./promotion";

const variantId = "6f1c2a40-8b0e-4c1e-9a55-2f4f3a1d9b01";
const base = {
  name: "Cyber Monday",
  description: "",
  active: true,
  startsAt: "2026-11-30T00:00",
  endsAt: "2026-12-01T23:59",
  showCard: false,
  cardTitle: "",
  cardText: "",
  cardCta: "",
  items: [{ variantId, promoPrice: 9000 }],
};

describe("fechas de promociones (hora argentina)", () => {
  it("convierte de y a hora local sin perder el valor", () => {
    expect(localToIso("2026-11-30T00:00")).toBe("2026-11-30T03:00:00.000Z");
    expect(isoToLocal("2026-11-30T03:00:00.000Z")).toBe("2026-11-30T00:00");
    expect(localToIso("")).toBeNull();
    expect(isoToLocal(null)).toBe("");
  });
});

describe("promotionSchema", () => {
  it("acepta una promo válida y arma el payload de la base", () => {
    const parsed = promotionSchema.parse(base);
    const payload = toPromotionPayload(parsed, "cyber-monday");
    expect(payload.starts_at).toBe("2026-11-30T03:00:00.000Z");
    expect(payload.items).toEqual([{ variant_id: variantId, promo_price: 9000 }]);
  });

  it("rechaza fin anterior al inicio, precios en cero y productos repetidos", () => {
    expect(promotionSchema.safeParse({ ...base, endsAt: "2026-11-29T00:00" }).success).toBe(false);
    expect(promotionSchema.safeParse({ ...base, items: [{ variantId, promoPrice: 0 }] }).success).toBe(false);
    expect(promotionSchema.safeParse({ ...base, items: [base.items[0], base.items[0]] }).success).toBe(false);
  });

  it("sin productos solo vale si es una card informativa", () => {
    expect(promotionSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(promotionSchema.safeParse({ ...base, items: [], showCard: true, cardTitle: "Día del Padre" }).success).toBe(true);
  });
});
