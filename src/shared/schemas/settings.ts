import * as z from "zod";
import { MAX_INSTAGRAM_POSTS, parseInstagramPosts } from "../instagram";
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
  /** Links de publicaciones de Instagram, uno por línea. */
  instagramPosts: optionalText(1200).superRefine((v, ctx) => {
    const { urls, invalid } = parseInstagramPosts(v);
    if (invalid.length > 0) {
      ctx.addIssue({ code: "custom", message: `No es un link de publicación o reel de Instagram: ${invalid[0].slice(0, 60)}` });
    } else if (urls.length > MAX_INSTAGRAM_POSTS) {
      ctx.addIssue({ code: "custom", message: `Máximo ${MAX_INSTAGRAM_POSTS} publicaciones` });
    }
  }),
  hoursWeekdays: optionalText(60),
  hoursSaturday: optionalText(60),
  hoursSunday: optionalText(60),
});

export type StoreSettingsInput = z.input<typeof storeSettingsSchema>;
