import "server-only";
import { cache } from "react";
import { safeSearch } from "@/shared/query";
import { offerableFacets, parseShopFilters } from "@/shared/shop-filters";
import type { SearchParams } from "@/shared/query";
import { EMPTY_FACETS, type HomeData, type ProductPageData, type PublicCategory, type PublicPaymentMethod, type PublicProduct, type PublicPromotion, type PublicVariant, type SearchResult, type ShopFacets, type ShopFilters, type StoreInfo } from "@/shared/types";
import { demoSource } from "./demo-source";
import { EMPTY_STORE, type CatalogSource, type FacetQuery, type ProductQuery } from "./source";
import { supabaseSource } from "./supabase-source";

/**
 * Lecturas de la web pública. Es lo único que importan las páginas de la landing.
 * Con ELMATE_DEMO=1 usa datos de ejemplo en memoria; si no, Supabase.
 * Si la base falla, devuelve listas vacías: la web se ve incompleta pero no se cae.
 */

export const isDemoCatalog = process.env.ELMATE_DEMO === "1";
const source: CatalogSource = isDemoCatalog ? demoSource : supabaseSource;

export const SHOP_PAGE_SIZE = 12;

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
/** Categorías con al menos un producto en la web: una vacía no se muestra (menú, home) porque llevaría a una lista vacía. */
export const getCategories = cache(
  async (): Promise<PublicCategory[]> => (await safe("categorías", [], () => source.categories())).filter((c) => c.product_count > 0),
);
/** Promociones vigentes ahora. */
export const getPromotions = cache((): Promise<PublicPromotion[]> => safe("promociones", [], () => source.promotions()));

export async function getHomeData(): Promise<HomeData> {
  const [featured, offers, bestIds] = await Promise.all([
    // Las vidrieras de la home muestran solo productos con foto real
    products({ featuredOnly: true, withImages: true, sort: "destacados", limit: 8 }),
    products({ onlyOffers: true, withImages: true, sort: "mayor-descuento", limit: 4 }),
    safe("más vendidos", [] as string[], () => source.bestSellerIds()),
  ]);

  // Más vendidos según las ventas; si todavía hay pocas, se completa con destacados
  const ids = bestIds.slice(0, 4);
  const best = ids.length ? (await products({ ids, withImages: true, sort: "destacados", limit: 4 })).rows : [];
  best.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  if (best.length < 4) {
    const fill = await products({ withImages: true, sort: "destacados", limit: 8 });
    for (const p of fill.rows) {
      if (best.length >= 4) break;
      if (!best.some((b) => b.id === p.id)) best.push(p);
    }
  }

  return { featured: featured.rows, offers: offers.rows, bestSellers: best };
}

/**
 * Productos de una promoción para ilustrar su card en la home: los de mayor descuento que tengan foto (hasta 4).
 * Sin ninguno, la home usa los productos en oferta.
 */
export async function getPromotionShowcase(slug: string): Promise<PublicProduct[]> {
  const ids = await safe("los productos de la promoción", [] as string[], () => source.promotionProductIds(slug));
  if (ids.length === 0) return [];
  const { rows } = await products({ ids: ids.slice(0, 100), sort: "mayor-descuento", limit: 12 });
  return rows.filter((p) => p.images.length > 0).slice(0, 4);
}

/** Claves de las opciones de variante que existen en el catálogo (una consulta por visita). */
const getShopOptionKeys = cache(async (): Promise<string[]> => {
  const facets = await safe("opciones de variante", EMPTY_FACETS, () => source.facets({}));
  return offerableFacets(facets).options.map((o) => o.key);
});

/** Filtros de la URL; los parámetros que no son una opción del catálogo (?ref=..., ?utm_...) se ignoran. */
export async function resolveShopFilters(sp: SearchParams): Promise<ShopFilters> {
  return parseShopFilters(sp, await getShopOptionKeys());
}

/** Filtros de la tienda en el formato de las consultas; null si la promo pedida no tiene productos. */
async function shopQueryFilters(f: ShopFilters): Promise<FacetQuery | null> {
  let ids: string[] | undefined;
  if (f.promo) {
    ids = await safe("los productos de la promoción", [] as string[], () => source.promotionProductIds(f.promo));
    if (ids.length === 0) return null;
  }
  return {
    ids,
    q: f.q || undefined,
    category: f.category || undefined,
    onlyOffers: f.offers,
    brands: f.brands,
    priceMin: f.price.min ?? undefined,
    priceMax: f.price.max ?? undefined,
    options: f.options,
    inStock: f.inStock,
  };
}

export async function listShopProducts(f: ShopFilters): Promise<{ rows: PublicProduct[]; total: number }> {
  const query = await shopQueryFilters(f);
  if (!query) return { rows: [], total: 0 };
  return products({ ...query, sort: f.sort, limit: SHOP_PAGE_SIZE, offset: (f.page - 1) * SHOP_PAGE_SIZE });
}

/** Opciones de los filtros laterales con su cantidad. Si fallan, la tienda se ve sin barra lateral. */
export async function getShopFacets(f: ShopFilters): Promise<ShopFacets> {
  const query = await shopQueryFilters(f);
  if (!query) return EMPTY_FACETS;
  return offerableFacets(await safe("filtros", EMPTY_FACETS, () => source.facets(query)));
}

export const SEARCH_LIMIT = 6;

/** Búsqueda mientras se escribe (buscador del header): los primeros resultados y el total. */
export async function searchProducts(text: string): Promise<{ rows: SearchResult[]; total: number }> {
  const q = safeSearch(text);
  if (q.length < 2) return { rows: [], total: 0 };
  const { rows, total } = await products({ q, sort: "destacados", limit: SEARCH_LIMIT });
  return {
    total,
    rows: rows.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      image: p.images[0] ?? null,
      price: p.price,
      compare_at_price: p.compare_at_price,
      has_price_range: p.has_price_range,
      unit: p.unit,
      category_name: p.category_name,
    })),
  };
}

// cache(): la metadata y la página piden el mismo producto en una visita
export const getProductPage = cache(async (slug: string): Promise<ProductPageData | null> => {
  const product = await safe("el producto", null, () => source.productBySlug(slug));
  if (!product) return null;

  const [variants, related, paymentMethods] = await Promise.all([
    safe("las variantes", [] as PublicVariant[], () => source.variants(product.id)),
    products({ category: product.category_slug ?? undefined, excludeId: product.id, sort: "destacados", limit: 4 }),
    safe("las formas de pago", [] as PublicPaymentMethod[], () => source.paymentMethods()),
  ]);
  return { product, variants, related: related.rows, paymentMethods };
});
