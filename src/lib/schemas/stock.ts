import * as z from "zod";

const quantity = z
  .number({ error: "Ingresá un número entero" })
  .int({ error: "Tiene que ser un número entero" });

export const stockInSchema = z.object({
  variantId: z.uuid(),
  quantity: quantity.min(1, { error: "Tiene que ser al menos 1" }).max(100_000, { error: "Cantidad demasiado grande" }),
  /** Costo unitario de esta compra; si se informa, pasa a ser el costo actual. */
  unitCost: z.number({ error: "Ingresá un número" }).min(0, { error: "No puede ser negativo" }).max(999_999_999).nullable(),
  reason: z.string().trim().max(200, { error: "Máximo 200 caracteres" }),
});

export const stockAdjustSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("count"),
    variantId: z.uuid(),
    counted: quantity.min(0, { error: "No puede ser negativo" }).max(1_000_000, { error: "Cantidad demasiado grande" }),
    reason: z.string().trim().max(200, { error: "Máximo 200 caracteres" }),
  }),
  z.object({
    mode: z.literal("delta"),
    variantId: z.uuid(),
    delta: quantity
      .min(-1_000_000, { error: "Cantidad demasiado grande" })
      .max(1_000_000, { error: "Cantidad demasiado grande" })
      .refine((n) => n !== 0, { error: "La diferencia no puede ser 0" }),
    reason: z
      .string()
      .trim()
      .min(3, { error: "Indicá el motivo (ej: rotura, faltante)" })
      .max(200, { error: "Máximo 200 caracteres" }),
  }),
]);

export type StockInInput = z.input<typeof stockInSchema>;
export type StockAdjustInput = z.input<typeof stockAdjustSchema>;
