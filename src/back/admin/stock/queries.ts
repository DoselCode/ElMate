import "server-only";
import { requireAdmin, requireStaff } from "@/back/admin/auth/session";
import { createClient } from "@/back/shared/supabase/server";
import { PAGE_SIZE, pageParam, param, safeSearch, type SearchParams } from "@/shared/query";
import type {
  MovementFilters,
  MovementRow,
  MovementType,
  Option,
  Paged,
  ProductForEdit,
  StockFilters,
  StockRow,
  StockSummary,
} from "@/shared/types";

/**
 * Lecturas del panel de stock. Cada función valida el permiso de quien consulta (además de RLS
 * en la base), así una página nueva no puede olvidarse de hacerlo.
 */

const MOVEMENT_TYPES: MovementType[] = ["ingreso", "venta", "ajuste", "anulacion"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const pageRange = (page: number) => {
  const from = (page - 1) * PAGE_SIZE;
  return [from, from + PAGE_SIZE - 1] as const;
};

// ---- Filtros desde la URL ------------------------------------------------------------------

export function parseStockFilters(sp: SearchParams): StockFilters {
  const status = param(sp, "status");
  return {
    q: safeSearch(param(sp, "q")),
    supplier: param(sp, "supplier"),
    category: param(sp, "category"),
    status: status === "low" || status === "out" ? status : "",
    showInactive: param(sp, "inactive") === "1",
    page: pageParam(sp),
  };
}

export function parseMovementFilters(sp: SearchParams): MovementFilters {
  const type = param(sp, "type") as MovementType;
  return {
    q: safeSearch(param(sp, "q")),
    type: MOVEMENT_TYPES.includes(type) ? type : "",
    page: pageParam(sp),
  };
}

// ---- Inventario ----------------------------------------------------------------------------

/** Variantes del inventario según los filtros, paginadas. El costo llega null si no es admin. */
export async function getStockList(f: StockFilters): Promise<Paged<StockRow>> {
  await requireStaff();
  const supabase = await createClient();

  let query = supabase.from("stock_overview").select("*", { count: "exact" });
  if (f.q) query = query.or(`product_name.ilike.%${f.q}%,sku.ilike.%${f.q}%,barcode.eq.${f.q}`);
  if (f.supplier) query = query.eq("supplier_id", f.supplier);
  if (f.category) query = query.eq("category_id", f.category);
  if (f.status === "low") query = query.eq("low_stock", true);
  if (f.status === "out") query = query.eq("stock", 0);
  if (!f.showInactive) query = query.eq("active", true);

  const { data, count, error } = await query
    .order("product_name")
    .order("variant_label")
    .range(...pageRange(f.page));

  return { rows: (data ?? []) as StockRow[], total: count ?? 0, error: Boolean(error) };
}

/** Totales de las tarjetas de resumen (solo variantes activas). */
export async function getStockSummary(): Promise<StockSummary> {
  await requireStaff();
  const supabase = await createClient();
  // head:true cuenta sin traer filas
  const activeCount = () =>
    supabase.from("stock_overview").select("variant_id", { count: "exact", head: true }).eq("active", true);

  const [total, low, out] = await Promise.all([
    activeCount(),
    activeCount().eq("low_stock", true).gt("stock", 0),
    activeCount().eq("stock", 0),
  ]);
  return { total: total.count ?? 0, low: low.count ?? 0, out: out.count ?? 0 };
}

/** Categorías y proveedores activos, para filtros y para el formulario de producto. */
export async function getCatalogOptions(): Promise<{ categories: Option[]; suppliers: Option[] }> {
  await requireStaff();
  const supabase = await createClient();
  const [categories, suppliers] = await Promise.all([
    supabase.from("categories").select("id, name").order("sort_order").order("name"),
    supabase.from("suppliers").select("id, name").eq("active", true).order("name"),
  ]);
  return { categories: (categories.data ?? []) as Option[], suppliers: (suppliers.data ?? []) as Option[] };
}

// ---- Movimientos ---------------------------------------------------------------------------

export async function getMovements(f: MovementFilters): Promise<Paged<MovementRow>> {
  await requireStaff();
  const supabase = await createClient();

  let query = supabase.from("stock_movement_log").select("*", { count: "exact" });
  if (f.q) query = query.or(`product_name.ilike.%${f.q}%,sku.ilike.%${f.q}%`);
  if (f.type) query = query.eq("type", f.type);

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(...pageRange(f.page));

  return { rows: (data ?? []) as MovementRow[], total: count ?? 0, error: Boolean(error) };
}

// ---- Producto para editar ------------------------------------------------------------------

/** Producto con sus variantes y costos, o null si no existe / está archivado. Solo admin. */
export async function getProductForEdit(id: string): Promise<ProductForEdit | null> {
  await requireAdmin();
  if (!UUID.test(id)) return null;
  const supabase = await createClient();

  const [productRes, variantsRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, description, category_id, supplier_id, option_names, images, is_visible, badge")
      .eq("id", id)
      .is("archived_at", null)
      .maybeSingle(),
    supabase
      .from("product_variants")
      .select("id, sku, barcode, attributes, price, compare_at_price, min_stock, stock, active")
      .eq("product_id", id)
      .order("created_at"),
  ]);

  const product = productRes.data;
  if (!product) return null;

  const variants = variantsRes.data ?? [];
  const { data: costRows } = await supabase
    .from("variant_costs")
    .select("variant_id, cost")
    .in("variant_id", variants.map((v) => v.id));
  const costs = new Map((costRows ?? []).map((c) => [c.variant_id, Number(c.cost)]));

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    categoryId: product.category_id,
    supplierId: product.supplier_id,
    optionNames: product.option_names,
    images: product.images,
    isVisible: product.is_visible,
    badge: product.badge,
    variants: variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      barcode: v.barcode,
      attributes: (v.attributes ?? {}) as Record<string, string>,
      price: Number(v.price),
      compareAtPrice: v.compare_at_price === null ? null : Number(v.compare_at_price),
      cost: costs.get(v.id) ?? 0,
      minStock: v.min_stock,
      stock: v.stock,
      active: v.active,
    })),
  };
}
