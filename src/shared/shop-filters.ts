import { buildQuery, pageParam, param, safeSearch, type SearchParams } from "./query";
import type { PriceRange, ShopFacets, ShopFilters, ShopSort } from "./types";

/**
 * Filtros de /tienda en la URL. Los links viejos (?categoria, ?ofertas, ?promo, ?q, ?orden, ?page)
 * siguen igual; los nuevos son ?marca=a,b, ?precio=min-max, ?stock=1 y uno por opción de variante
 * (?color=rojo,negro). Todo lo inválido se ignora.
 */

export const SHOP_SORTS: ShopSort[] = ["destacados", "precio-asc", "precio-desc", "nuevos"];
export const RESERVED_PARAMS: readonly string[] = ["q", "categoria", "orden", "ofertas", "promo", "page", "marca", "precio", "stock"];

const SLUG = /^[a-z0-9-]{1,80}$/;
const OPTION_KEY = /^[a-z0-9-]{1,40}$/;
const MAX_VALUES = 20;
const MAX_OPTIONS = 5;

const slugParam = (sp: SearchParams, key: string) => (SLUG.test(param(sp, key)) ? param(sp, key) : "");

/** "a,b,,c" -> ["a","b","c"], solo claves válidas, sin repetidos, hasta 20. */
function listParam(raw: string): string[] {
  const values = raw.split(",").map((v) => v.trim()).filter((v) => SLUG.test(v));
  return [...new Set(values)].slice(0, MAX_VALUES);
}

function priceParam(raw: string): PriceRange {
  const m = /^(\d{0,9})-(\d{0,9})$/.exec(raw);
  if (!m) return { min: null, max: null };
  const min = m[1] ? Number(m[1]) : null;
  const max = m[2] ? Number(m[2]) : null;
  return min !== null && max !== null && min > max ? { min: max, max: min } : { min, max };
}

export function parseShopFilters(sp: SearchParams): ShopFilters {
  const sort = param(sp, "orden") as ShopSort;
  const options: Record<string, string[]> = {};
  for (const key of Object.keys(sp)) {
    if (Object.keys(options).length >= MAX_OPTIONS) break;
    if (RESERVED_PARAMS.includes(key) || !OPTION_KEY.test(key)) continue;
    const values = listParam(param(sp, key));
    if (values.length) options[key] = values;
  }
  return {
    q: safeSearch(param(sp, "q")),
    category: slugParam(sp, "categoria"),
    sort: SHOP_SORTS.includes(sort) ? sort : "destacados",
    offers: param(sp, "ofertas") === "1",
    promo: slugParam(sp, "promo"),
    page: pageParam(sp),
    brands: listParam(param(sp, "marca")),
    price: priceParam(param(sp, "precio")),
    options,
    inStock: param(sp, "stock") === "1",
  };
}

/**
 * "?..." de los filtros con `patch` aplicado, sin valores vacíos ni por defecto. Cambiar un filtro
 * vuelve a la página 1, salvo que el patch traiga `page`.
 */
export function shopQuery(f: ShopFilters, patch: Partial<ShopFilters> = {}): string {
  const next: ShopFilters = { ...f, ...patch, page: patch.page ?? (Object.keys(patch).length ? 1 : f.page) };
  const { min, max } = next.price;
  const options = Object.fromEntries(
    Object.entries(next.options).filter(([, v]) => v.length).map(([k, v]) => [k, v.join(",")]),
  );
  return buildQuery({
    q: next.q,
    categoria: next.category,
    marca: next.brands.join(","),
    precio: min === null && max === null ? undefined : `${min ?? ""}-${max ?? ""}`,
    ...options,
    ofertas: next.offers ? "1" : undefined,
    stock: next.inStock ? "1" : undefined,
    promo: next.promo,
    orden: next.sort === "destacados" ? undefined : next.sort,
    page: next.page > 1 ? next.page : undefined,
  });
}

export function toggleValue(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((v) => v !== key) : [...list, key];
}

/** Cantidad de filtros elegidos (para el botón "Filtros (N)"). */
export function activeFilterCount(f: ShopFilters): number {
  const optionValues = Object.values(f.options).reduce((n, v) => n + v.length, 0);
  const price = f.price.min !== null || f.price.max !== null ? 1 : 0;
  return Number(Boolean(f.category)) + f.brands.length + optionValues + price + Number(f.offers) + Number(f.inStock) + Number(Boolean(f.promo));
}

/** Saca las opciones de variante que no se pueden usar en la URL (clave reservada o inválida). */
export function offerableFacets(f: ShopFacets): ShopFacets {
  return { ...f, options: f.options.filter((o) => OPTION_KEY.test(o.key) && !RESERVED_PARAMS.includes(o.key)) };
}
