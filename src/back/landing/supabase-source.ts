import "server-only";
import { createPublicClient } from "@/back/shared/supabase/public";
import { EMPTY_FACETS, type PublicCategory, type PublicPaymentMethod, type PublicProduct, type PublicPromotion, type PublicVariant, type ShopFacets, type StoreInfo } from "@/shared/types";
import { EMPTY_STORE, type CatalogSource, type FacetQuery, type ProductQuery } from "./source";

/** Catálogo real: solo lee las vistas public_* (nunca las tablas, que tienen costos y stock exacto). */

// PostgREST devuelve numeric como número o texto según el tamaño: se normaliza acá
const toProduct = (r: PublicProduct): PublicProduct => ({
  ...r,
  price: Number(r.price),
  compare_at_price: r.compare_at_price === null ? null : Number(r.compare_at_price),
});

const toVariant = (r: PublicVariant): PublicVariant => ({
  ...r,
  price: Number(r.price),
  compare_at_price: r.compare_at_price === null ? null : Number(r.compare_at_price),
});

type RawFacets = Omit<ShopFacets, "price" | "inStock"> & { price: { min: number | string; max: number | string } | null; in_stock: number };

// numeric llega como texto desde PostgREST
const toFacets = (r: RawFacets | null): ShopFacets =>
  r
    ? {
        categories: r.categories,
        brands: r.brands,
        options: r.options,
        price: r.price ? { min: Number(r.price.min), max: Number(r.price.max) } : null,
        offers: r.offers,
        inStock: r.in_stock,
      }
    : EMPTY_FACETS;

export const supabaseSource: CatalogSource = {
  async storeInfo(): Promise<StoreInfo> {
    const { data, error } = await createPublicClient().from("public_store_info").select("*").maybeSingle();
    if (error) throw error;
    return { ...EMPTY_STORE, ...(data ?? {}) };
  },

  async categories(): Promise<PublicCategory[]> {
    const { data, error } = await createPublicClient()
      .from("public_categories")
      .select("*")
      .order("sort_order")
      .order("name");
    if (error) throw error;
    return (data ?? []) as PublicCategory[];
  },

  async promotions(): Promise<PublicPromotion[]> {
    const { data, error } = await createPublicClient().from("public_promotions").select("*").order("starts_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as PublicPromotion[];
  },

  async promotionProductIds(slug: string): Promise<string[]> {
    const { data, error } = await createPublicClient().from("public_promotion_products").select("product_id").eq("promotion_slug", slug);
    if (error) throw error;
    return (data ?? []).map((r) => r.product_id as string);
  },

  async products(q: ProductQuery) {
    let query = createPublicClient().from("public_products").select("*", { count: "exact" });
    // Cada palabra tiene que aparecer en el nombre, en cualquier orden ("mate algarrobo")
    for (const word of (q.q ?? "").split(/\s+/).filter(Boolean)) query = query.ilike("name", `%${word}%`);
    if (q.category) query = query.eq("category_slug", q.category);
    if (q.onlyOffers) query = query.not("compare_at_price", "is", null);
    if (q.featuredOnly) query = query.eq("is_featured", true);
    if (q.inNewsOnly) query = query.eq("show_in_news", true);
    if (q.withImages) query = query.not("images", "eq", "{}");
    if (q.ids) query = query.in("id", q.ids);
    if (q.excludeId) query = query.neq("id", q.excludeId);
    if (q.brands?.length) query = query.in("brand_key", q.brands);
    if (q.priceMin != null) query = query.gte("price", q.priceMin);
    if (q.priceMax != null) query = query.lte("price", q.priceMax);
    if (q.inStock) query = query.eq("in_stock", true);
    // O dentro de cada opción (overlaps), Y entre opciones; con "en stock" se miran solo variantes disponibles
    const tagColumn = q.inStock ? "option_tags_in_stock" : "option_tags";
    for (const [key, values] of Object.entries(q.options ?? {})) {
      if (values.length) query = query.overlaps(tagColumn, values.map((v) => `${key}:${v}`));
    }

    if (q.sort === "precio-asc") query = query.order("price", { ascending: true });
    else if (q.sort === "precio-desc") query = query.order("price", { ascending: false });
    else if (q.sort === "nuevos") query = query.order("created_at", { ascending: false });
    else if (q.sort === "mayor-descuento") query = query.order("discount_pct", { ascending: false, nullsFirst: false });
    // Destacados primero y, entre ellos, el orden manual del panel (los sin orden van al final)
    else {
      query = query
        .order("is_featured", { ascending: false })
        .order("web_order", { ascending: true, nullsFirst: false })
        .order("in_stock", { ascending: false });
    }
    query = query.order("name");

    const offset = q.offset ?? 0;
    const { data, count, error } = await query.range(offset, offset + q.limit - 1);
    if (error) throw error;
    return { rows: ((data ?? []) as PublicProduct[]).map(toProduct), total: count ?? 0 };
  },

  async facets(q: FacetQuery) {
    const { data, error } = await createPublicClient().rpc("shop_facets", {
      p_filters: {
        q: q.q,
        category: q.category,
        ids: q.ids,
        brands: q.brands,
        price_min: q.priceMin,
        price_max: q.priceMax,
        options: q.options,
        offers: q.onlyOffers,
        in_stock: q.inStock,
      },
    });
    if (error) throw error;
    return toFacets(data as RawFacets);
  },

  async productBySlug(slug: string) {
    const { data, error } = await createPublicClient().from("public_products").select("*").eq("slug", slug).maybeSingle();
    if (error) throw error;
    return data ? toProduct(data as PublicProduct) : null;
  },

  async variants(productId: string) {
    const { data, error } = await createPublicClient()
      .from("public_variants")
      .select("*")
      .eq("product_id", productId)
      .order("price");
    if (error) throw error;
    return ((data ?? []) as PublicVariant[]).map(toVariant);
  },

  async bestSellerIds() {
    const { data, error } = await createPublicClient().from("public_best_sellers").select("product_id").order("rank");
    if (error) throw error;
    return (data ?? []).map((r) => r.product_id as string);
  },

  async paymentMethods() {
    const { data, error } = await createPublicClient().from("public_payment_methods").select("*").order("sort_order");
    if (error) throw error;
    return ((data ?? []) as PublicPaymentMethod[]).map((m) => ({ ...m, adjustment_pct: Number(m.adjustment_pct) }));
  },
};
