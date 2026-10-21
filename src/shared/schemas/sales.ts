import * as z from "zod";

const money = z
  .number({ error: "Ingresá un monto" })
  .min(0, { error: "No puede ser negativo" })
  .max(999_999_999, { error: "El monto es demasiado grande" });

const threeDecimals = (n: number) => Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6;

export const openCashSchema = z.object({ openingCash: money });

/** Retiro (egreso) o ingreso de efectivo con la caja abierta. */
export const cashMovementSchema = z.object({
  type: z.enum(["ingreso", "egreso"]),
  amount: money.gt(0, { error: "Tiene que ser mayor a 0" }),
  reason: z
    .string()
    .trim()
    .min(3, { error: "Indicá el motivo (ej: retiro, cambio, pago a proveedor)" })
    .max(120, { error: "Máximo 120 caracteres" }),
});

export const closeCashSchema = z
  .object({
    countedCash: money,
    /** Efectivo que queda en la caja para abrir mañana. */
    cashLeft: money,
    notes: z.string().trim().max(300, { error: "Máximo 300 caracteres" }),
  })
  .refine((c) => c.cashLeft <= c.countedCash, {
    path: ["cashLeft"],
    error: "No puede ser más de lo contado",
  });

/** Descuento en porcentaje (0–100) o en monto fijo. */
export const discountSchema = z
  .object({ type: z.enum(["pct", "amount"]), value: money })
  .refine((d) => d.type === "amount" || d.value <= 100, { path: ["value"], error: "Entre 0 y 100 %" });

export const saleSchema = z.object({
  paymentMethodId: z.uuid({ error: "Elegí la forma de pago" }),
  items: z
    .array(
      z.object({
        variantId: z.uuid(),
        quantity: z
          .number({ error: "Cantidad inválida" })
          .gt(0, { error: "La cantidad tiene que ser mayor a 0" })
          .max(100_000, { error: "Cantidad demasiado grande" })
          .refine(threeDecimals, { error: "Máximo 3 decimales" }),
        /** Descuento de esta línea (opcional). */
        discount: discountSchema.nullable(),
      }),
    )
    .min(1, { error: "Agregá al menos un producto" })
    .max(100, { error: "Máximo 100 productos por venta" }),
  /** Descuento general sobre el subtotal, antes del ajuste de la forma de pago. */
  discount: discountSchema,
  customer: z.string().trim().max(80, { error: "Máximo 80 caracteres" }),
  notes: z.string().trim().max(300, { error: "Máximo 300 caracteres" }),
});

export type Discount = z.infer<typeof discountSchema>;

export const voidSaleSchema = z.object({
  saleId: z.uuid(),
  reason: z.string().trim().min(3, { error: "Indicá el motivo" }).max(200, { error: "Máximo 200 caracteres" }),
});

export type SaleInput = z.input<typeof saleSchema>;
