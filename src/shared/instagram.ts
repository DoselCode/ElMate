/**
 * Links de publicaciones de Instagram: se pegan en "Datos del local" y la home las muestra incrustadas
 * (https://www.instagram.com/p/CODIGO/embed). Funciones puras: las usan el formulario, el servidor y la web.
 */

export const MAX_INSTAGRAM_POSTS = 6;

const POST_RE = /^https?:\/\/(?:www\.|m\.)?instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,})/i;

/** Link canónico de la publicación (sin parámetros ni perfil), o null si no es de una publicación/reel. */
export function normalizeInstagramPost(raw: string): string | null {
  const m = POST_RE.exec(raw.trim());
  if (!m) return null;
  const kind = m[1].toLowerCase() === "p" ? "p" : m[1].toLowerCase() === "tv" ? "tv" : "reel";
  return `https://www.instagram.com/${kind}/${m[2]}/`;
}

/** Dirección del iframe de una publicación ya normalizada. */
export const instagramEmbedUrl = (post: string): string => `${post}embed`;

/**
 * Interpreta el texto del formulario (un link por línea o separados por espacios/comas).
 * `invalid`: lo que no es un link de publicación; `urls`: los válidos, sin repetir y en el orden en que se pegaron.
 */
export function parseInstagramPosts(text: string): { urls: string[]; invalid: string[] } {
  const urls: string[] = [];
  const invalid: string[] = [];
  for (const token of text.split(/[\s,;]+/).filter(Boolean)) {
    const url = normalizeInstagramPost(token);
    if (!url) invalid.push(token);
    else if (!urls.includes(url)) urls.push(url);
  }
  return { urls, invalid };
}
