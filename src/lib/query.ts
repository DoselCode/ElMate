type Params = Record<string, string | string[] | undefined>;

/** Valor de un searchParam como string (si viene repetido, el primero). */
export function param(sp: Params, key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

export function pageParam(sp: Params): number {
  const n = Number.parseInt(param(sp, "page"), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10_000) : 1;
}

/**
 * Texto de búsqueda seguro para armar un filtro .or() de PostgREST: se quitan los caracteres que
 * rompen la sintaxis (, ( ) " \ *) y los comodines de LIKE que ingrese el usuario.
 */
export function safeSearch(text: string): string {
  return text.replace(/[,()"\\*%_]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

/** Arma "?a=1&b=2" omitiendo vacíos, para los links de paginación. */
export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v) !== "") usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export const PAGE_SIZE = 25;
