import "server-only";
import { cache } from "react";
import { pageParam, param, safeSearch, type SearchParams } from "@/shared/query";
import type {
  HomeData,
  ProductPageData,
  PublicCategory,
  PublicProduct,
  PublicVariant,
  ShopFilters,
  ShopSort,
  StoreInfo,
} from "@/shared/types";
import { demoSource } from "./demo-source";
import { EMPTY_STORE, type CatalogSource, type ProductQuery } from "./source";
import { supabaseSource } from "./supabase-source";

/**
 * Lecturas de la web pública. Es lo único que importan las páginas de la landing.
 * Con ELMATE_DEMO=1 usa datos de ejemplo en memoria; si no, Supabase.
 * Si la base falla, devuelve listas vacías: la web se ve incompleta pero no se cae.
 */

export const isDemoCatalog = process.env.ELMATE_DEMO === "1";
const source: CatalogSource = isDemoCatalog ? demoSource : supabaseSource;

export const SHOP_PAGE_SIZE = 12;
const SORTS: ShopSort[] = ["destacados", "precio-asc", "precio-desc", "nuevos"];

async function safe<T>(what: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`Catálogo: no se pudo cargar ${what}`, error);
    return fallback;
  }
}

const products = (q: ProductQuery) => safe("productos", { rows: [], total: 0 }, () => source.products(q));

// cache(): el layout y la página piden lo mismo en una visita; se consulta una sola vez
export const getStoreInfo = cache((): Promise<StoreInfo> => safe("datos del local", EMPTY_STORE, () => source.storeInfo()));
export const getCategories = cache((): Promise<PublicCategory[]> => safe("categorías", [], () => source.categories()));

export async function getHomeData(): Promise<HomeData> {
  const [offers, newest, bestIds] = await Promise.all([
    products({ onlyOffers: true, sort: "mayor-descuento", limit: 3 }),
    products({ sort: "nuevos", limit: 4 }),
    safe("más vendidos", [] as string[], () => source.bestSellerIds()),
  ]);

  // Más vendidos según las ventas; si todavía hay pocas, se completa con destacados
  const ids = bestIds.slice(0, 4);
  const best = ids.length ? (await products({ ids, sort: "destacados", limit: 4 })).rows : [];
  best.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  if (best.length < 4) {
    const fill = await products({ sort: "destacados", limit: 8 });
    for (const p of fill.rows) {
      if (best.length >= 4) break;
      if (!best.some((b) => b.id === p.id)) best.push(p);
    }
  }

  return { offers: offers.rows, bestSellers: best, newest: newest.rows };
}

export function parseShopFilters(sp: SearchParams): ShopFilters {
  const sort = param(sp, "orden") as ShopSort;
  return {
    q: safeSearch(param(sp, "q")),
    category: param(sp, "categoria"),
    sort: SORTS.includes(sort) ? sort : "destacados",
    offers: param(sp, "ofertas") === "1",
    page: pageParam(sp),
  };
}

export async function listShopProducts(f: ShopFilters): Promise<{ rows: PublicProduct[]; total: number }> {
  return products({
    q: f.q || undefined,
    category: f.category || undefined,
    onlyOffers: f.offers,
    sort: f.sort,
    limit: SHOP_PAGE_SIZE,
    offset: (f.page - 1) * SHOP_PAGE_SIZE,
  });
}

// cache(): la metadata y la página piden el mismo producto en una visita
export const getProductPage = cache(async (slug: string): Promise<ProductPageData | null> => {
  const product = await safe("el producto", null, () => source.productBySlug(slug));
  if (!product) return null;

  const [variants, related] = await Promise.all([
    safe("las variantes", [] as PublicVariant[], () => source.variants(product.id)),
    products({ category: product.category_slug ?? undefined, excludeId: product.id, sort: "destacados", limit: 4 }),
  ]);
  return { product, variants, related: related.rows };
});
