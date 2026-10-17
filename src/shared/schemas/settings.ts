import * as z from "zod";
import { normalizeWhatsappNumber } from "../whatsapp";

const optionalText = (max: number) => z.string().trim().max(max, { error: `Máximo ${max} caracteres` });
const optionalUrl = optionalText(200).refine((v) => v === "" || URL.canParse(v), {
  error: "Pegá el link completo (https://…)",
});

/** Datos del local que se muestran en la web y se usan para el pedido por WhatsApp. */
export const storeSettingsSchema = z.object({
  name: z.string().trim().min(2, { error: "El nombre es obligatorio" }).max(60, { error: "Máximo 60 caracteres" }),
  tagline: optionalText(160),
  whatsappNumber: optionalText(30).refine((v) => v === "" || normalizeWhatsappNumber(v) !== null, {
    error: "No parece un número válido. Ej: 11 5555-1234 o +54 9 11 5555-1234",
  }),
  phone: optionalText(30),
  email: optionalText(120).refine((v) => v === "" || z.email().safeParse(v).success, { error: "Email inválido" }),
  address: optionalText(160),
  instagramUrl: optionalUrl,
  facebookUrl: optionalUrl,
  hoursWeekdays: optionalText(60),
  hoursSaturday: optionalText(60),
  hoursSunday: optionalText(60),
});

export type StoreSettingsInput = z.input<typeof storeSettingsSchema>;
