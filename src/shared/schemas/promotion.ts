import * as z from "zod";

/**
 * Promociones: un conjunto de variantes con precio especial, entre dos fechas, y una card opcional en la home.
 * Las fechas se cargan en hora de Argentina (UTC−3, sin horario de verano) con inputs datetime-local.
 */

const AR_OFFSET = "-03:00";

/** "2026-11-30T09:00" (hora argentina) → ISO en UTC. Devuelve null si está vacío o es inválido. */
export function localToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(`${local}:00${AR_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO en UTC → "2026-11-30T09:00" en hora argentina, para el input datetime-local. */
export function isoToLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() - 3 * 3_600_000);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16);
}

export const promotionItemSchema = z.object({
  variantId: z.uuid(),
  promoPrice: z
    .number({ error: "Ingresá un precio" })
    .gt(0, { error: "Tiene que ser mayor a 0" })
    .max(999_999_999, { error: "El valor es demasiado grande" }),
});

export const promotionSchema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(2, { error: "Poné un nombre (mínimo 2 caracteres)" }).max(80, { error: "Máximo 80 caracteres" }),
    description: z.string().trim().max(500, { error: "Máximo 500 caracteres" }),
    /** Pausada = no se aplica aunque esté dentro de las fechas. */
    active: z.boolean(),
    startsAt: z.string().min(1, { error: "Elegí cuándo empieza" }),
    /** Vacío = sin fecha de fin. */
    endsAt: z.string(),
    showCard: z.boolean(),
    cardTitle: z.string().trim().max(80, { error: "Máximo 80 caracteres" }),
    cardText: z.string().trim().max(200, { error: "Máximo 200 caracteres" }),
    cardCta: z.string().trim().max(30, { error: "Máximo 30 caracteres" }),
    items: z.array(promotionItemSchema).max(300, { error: "Máximo 300 productos por promoción" }),
  })
  .superRefine((p, ctx) => {
    const start = localToIso(p.startsAt);
    const end = localToIso(p.endsAt);
    if (!start) ctx.addIssue({ code: "custom", path: ["startsAt"], message: "Fecha inválida" });
    if (p.endsAt && !end) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Fecha inválida" });
    if (start && end && end <= start) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Tiene que ser posterior al inicio" });

    // Una promo sin productos es válida solo si es una card informativa (ej. Día del Padre con link a la tienda)
    if (p.items.length === 0 && !p.showCard) {
      ctx.addIssue({ code: "custom", path: ["items"], message: "Agregá al menos un producto, o activá la card de la home." });
    }
    if (p.showCard && !(p.cardTitle || p.name)) {
      ctx.addIssue({ code: "custom", path: ["cardTitle"], message: "Poné un título para la card" });
    }
    const ids = p.items.map((i) => i.variantId);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: ["items"], message: "Hay productos repetidos" });
  });

export type PromotionInput = z.input<typeof promotionSchema>;
export type PromotionData = z.output<typeof promotionSchema>;

/** Arma el JSON que espera la función SQL save_promotion(). */
export function toPromotionPayload(p: PromotionData, slug: string) {
  return {
    id: p.id ?? null,
    name: p.name,
    slug,
    description: p.description,
    active: p.active,
    starts_at: localToIso(p.startsAt),
    ends_at: localToIso(p.endsAt),
    show_card: p.showCard,
    card_title: p.cardTitle || null,
    card_text: p.cardText || null,
    card_cta: p.cardCta || null,
    items: p.items.map((i) => ({ variant_id: i.variantId, promo_price: i.promoPrice })),
  };
}
