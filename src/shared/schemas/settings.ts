import * as z from "zod";
import { httpUrl, plainText } from "./text";
import { isHomeTextKey } from "../home-content";
import { isInstagramUrl, MAX_INSTAGRAM_POSTS, parseInstagramPosts } from "../instagram";
import { normalizeWhatsappNumber } from "../whatsapp";

const optionalText = (max: number) => plainText().max(max, { error: `Máximo ${max} caracteres` });
const optionalInstagram = optionalText(200).refine((v) => v === "" || isInstagramUrl(v), {
  error: "Pegá el link de tu perfil de Instagram (https://www.instagram.com/…)",
});

/** Datos del local que se muestran en la web y se usan para el pedido por WhatsApp. */
export const storeSettingsSchema = z.object({
  name: plainText().min(2, { error: "El nombre es obligatorio" }).max(60, { error: "Máximo 60 caracteres" }),
  tagline: optionalText(160),
  whatsappNumber: optionalText(30).refine((v) => v === "" || normalizeWhatsappNumber(v) !== null, {
    error: "No parece un número válido. Ej: 11 5555-1234 o +54 9 11 5555-1234",
  }),
  phone: optionalText(30),
  address: optionalText(160),
  instagramUrl: optionalInstagram,
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
  /** Logo subido (va en la web y en el panel). Vacío = el de siempre. */
  logo: z.union([z.literal(""), httpUrl("Logo inválido")]),
  /** Video de la portada. Vacío = la animación de siempre. */
  heroVideo: z.union([z.literal(""), httpUrl("Video inválido")]),
  /** Textos de la home que reemplazan a los de por defecto; vacío = el de por defecto. */
  homeTexts: z
    .record(z.string(), plainText().max(300, { error: "Máximo 300 caracteres" }))
    .refine((texts) => Object.keys(texts).every(isHomeTextKey), { error: "Hay un texto que no existe en la web" }),
});

export type StoreSettingsInput = z.input<typeof storeSettingsSchema>;
