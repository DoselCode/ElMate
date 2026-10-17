import * as z from "zod";

/** Una forma de pago con su ajuste sobre el precio de lista (−20 = 20 % de descuento). */
export const paymentMethodSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, { error: "Poné un nombre" }).max(40, { error: "Máximo 40 caracteres" }),
  adjustmentPct: z
    .number({ error: "Ingresá un número" })
    .min(-100, { error: "Entre −100 y 100" })
    .max(100, { error: "Entre −100 y 100" }),
  /** Suma al efectivo que tiene que haber en la caja. */
  isCash: z.boolean(),
  active: z.boolean(),
});

export const paymentMethodsSchema = z
  .array(paymentMethodSchema)
  .min(1, { error: "Tiene que haber al menos una forma de pago" })
  .max(20, { error: "Máximo 20 formas de pago" })
  .superRefine((list, ctx) => {
    const names = list.map((m) => m.name.trim().toLowerCase());
    names.forEach((n, i) => {
      if (names.indexOf(n) !== i) ctx.addIssue({ code: "custom", path: [i, "name"], message: "Nombre repetido" });
    });
    if (!list.some((m) => m.active)) {
      ctx.addIssue({ code: "custom", path: [], message: "Dejá al menos una forma de pago activa" });
    }
  });

export type PaymentMethodInput = z.input<typeof paymentMethodSchema>;
