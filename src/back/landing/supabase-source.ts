import "server-only";
import { createPublicClient } from "@/back/shared/supabase/public";
import type { PublicCategory, PublicProduct, PublicVariant, StoreInfo } from "@/shared/types";
import { EMPTY_STORE, type CatalogSource, type ProductQuery } from "./source";

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

  async products(q: ProductQuery) {
    let query = createPublicClient().from("public_products").select("*", { count: "exact" });
    if (q.q) query = query.ilike("name", `%${q.q}%`);
    if (q.category) query = query.eq("category_slug", q.category);
    if (q.onlyOffers) query = query.not("compare_at_price", "is", null);
    if (q.ids) query = query.in("id", q.ids);
    if (q.excludeId) query = query.neq("id", q.excludeId);

    if (q.sort === "precio-asc") query = query.order("price", { ascending: true });
    else if (q.sort === "precio-desc") query = query.order("price", { ascending: false });
    else if (q.sort === "nuevos") query = query.order("created_at", { ascending: false });
    else if (q.sort === "mayor-descuento") query = query.order("discount_pct", { ascending: false, nullsFirst: false });
    else query = query.order("is_featured", { ascending: false }).order("in_stock", { ascending: false });
    query = query.order("name");

    const offset = q.offset ?? 0;
    const { data, count, error } = await query.range(offset, offset + q.limit - 1);
    if (error) throw error;
    return { rows: ((data ?? []) as PublicProduct[]).map(toProduct), total: count ?? 0 };
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
};
