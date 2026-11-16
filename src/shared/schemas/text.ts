import * as z from "zod";

/**
 * Texto libre seguro para todo lo que escribe una persona (nombres, notas, descripciones…).
 * React ya escapa lo que muestra, esto corta el problema de raíz: el texto no puede traer etiquetas HTML,
 * esquemas ejecutables (javascript:) ni caracteres invisibles o de control (que sirven para disfrazar texto).
 * Se permiten saltos de línea y tabulaciones, y los emojis compuestos (ZWJ).
 */

// Rangos (código Unicode) de controles salvo tab/salto de línea, espacios de ancho cero, marcas de dirección de texto y BOM
const HIDDEN_RANGES: [number, number][] = [
  [0x00, 0x08], [0x0b, 0x0c], [0x0e, 0x1f], [0x7f, 0x7f],
  [0x200b, 0x200b], [0x200e, 0x200f], [0x202a, 0x202e], [0x2060, 0x2064], [0x2066, 0x2069], [0xfeff, 0xfeff],
];

function hasHidden(s: string): boolean {
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (HIDDEN_RANGES.some(([from, to]) => c >= from && c <= to)) return true;
  }
  return false;
}
// "<b", "</div", "<!--", "<?xml" y los esquemas que ejecutan código
const CODE = /<\s*\/?\s*[a-z!?]|(?:java|vb)script\s*:|data\s*:\s*text\/html/i;

export const isPlainText = (s: string) => !hasHidden(s) && !CODE.test(s);

export const PLAIN_TEXT_ERROR = "No se permiten etiquetas HTML, código ni caracteres invisibles";

/** String recortado y sin código. Se le encadenan .min() / .max() como a cualquier z.string(). */
export const plainText = () => z.string().trim().refine(isPlainText, { error: PLAIN_TEXT_ERROR });

/** URL web http(s) (para imágenes): no acepta javascript:, data:, file:… */
export const httpUrl = (message: string) =>
  z
    .url({ error: message })
    .max(500, { error: message })
    .refine((u) => /^https?:\/\//i.test(u), { error: message });
