import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { requireStaff } from "@/lib/auth";
import { PAGE_SIZE, pageParam, param, safeSearch } from "@/lib/query";
import { createClient } from "@/lib/supabase/server";
import type { Option, StockRow } from "@/lib/types";
import { StockTable } from "./stock-table";

export const metadata: Metadata = { title: "Inventario y stock" };

function SummaryCard({ label, value, href, tone }: { label: string; value: number; href: string; tone?: "danger" | "warning" }) {
  const color = tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <Link
      href={href}
      className="rounded-[var(--radius-card)] bg-surface p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-extrabold tabular-nums ${color}`}>{value}</p>
    </Link>
  );
}

export default async function StockPage({ searchParams }: PageProps<"/admin/stock">) {
  const user = await requireStaff();
  const isAdmin = user.role === "admin";
  const sp = await searchParams;

  const q = safeSearch(param(sp, "q"));
  const supplier = param(sp, "supplier");
  const category = param(sp, "category");
  const status = param(sp, "status"); // "" | "low" | "out"
  const showInactive = param(sp, "inactive") === "1";
  const page = pageParam(sp);
  const saved = param(sp, "saved") === "1";

  const supabase = await createClient();

  let list = supabase.from("stock_overview").select("*", { count: "exact" });
  if (q) list = list.or(`product_name.ilike.%${q}%,sku.ilike.%${q}%,barcode.eq.${q}`);
  if (supplier) list = list.eq("supplier_id", supplier);
  if (category) list = list.eq("category_id", category);
  if (status === "low") list = list.eq("low_stock", true);
  if (status === "out") list = list.eq("stock", 0);
  if (!showInactive) list = list.eq("active", true);
  const from = (page - 1) * PAGE_SIZE;
  list = list.order("product_name").order("variant_label").range(from, from + PAGE_SIZE - 1);

  // Conteos del resumen (solo variantes activas; head:true no trae filas)
  const activeCount = () => supabase.from("stock_overview").select("variant_id", { count: "exact", head: true }).eq("active", true);

  const [listRes, totalRes, lowRes, outRes, suppliersRes, categoriesRes] = await Promise.all([
    list,
    activeCount(),
    activeCount().eq("low_stock", true).gt("stock", 0),
    activeCount().eq("stock", 0),
    supabase.from("suppliers").select("id, name").eq("active", true).order("name"),
    supabase.from("categories").select("id, name").order("sort_order").order("name"),
  ]);

  const total = totalRes.count ?? 0;
  const low = lowRes.count ?? 0;
  const out = outRes.count ?? 0;
  const rows = (listRes.data ?? []) as StockRow[];
  const suppliers = (suppliersRes.data ?? []) as Option[];
  const categories = (categoriesRes.data ?? []) as Option[];
  const totalRows = listRes.count ?? 0;
  const hasFilters = Boolean(q || supplier || category || status || showInactive);
  const filterParams = { q, supplier, category, status, inactive: showInactive ? "1" : undefined };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-bold">Inventario y stock</h1>
        {isAdmin && (
          <Link href="/admin/stock/new" className={buttonClass("primary")}>
            <Plus size={18} weight="bold" aria-hidden /> Nuevo producto
          </Link>
        )}
      </header>

      {saved && (
        <p role="status" className="rounded-xl bg-success-soft px-4 py-2.5 text-sm font-medium text-success">
          Producto guardado correctamente.
        </p>
      )}

      <section aria-label="Resumen" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Variantes activas" value={total} href="/admin/stock" />
        <SummaryCard label="Stock bajo" value={low} href="/admin/stock?status=low" tone="warning" />
        <SummaryCard label="Sin stock" value={out} href="/admin/stock?status=out" tone="danger" />
      </section>

      <form method="get" action="/admin/stock" className="flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-56 flex-1">
          <label htmlFor="q" className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
            Buscar
          </label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Nombre, código o código de barras" className={inputClass} />
        </div>
        <div>
          <label htmlFor="category" className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
            Categoría
          </label>
          <select id="category" name="category" defaultValue={category} className={inputClass}>
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="supplier" className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
            Proveedor
          </label>
          <select id="supplier" name="supplier" defaultValue={supplier} className={inputClass}>
            <option value="">Todos</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
            Stock
          </label>
          <select id="status" name="status" defaultValue={status} className={inputClass}>
            <option value="">Todo</option>
            <option value="low">Bajo o agotado</option>
            <option value="out">Sin stock</option>
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2.5 text-sm">
          <input type="checkbox" name="inactive" value="1" defaultChecked={showInactive} className="size-4 accent-primary" />
          Ver inactivas
        </label>
        <button type="submit" className={buttonClass("primary")}>
          Filtrar
        </button>
        {hasFilters && (
          <Link href="/admin/stock" className={buttonClass("ghost")}>
            Limpiar
          </Link>
        )}
      </form>

      {listRes.error ? (
        <p role="alert" className="rounded-xl bg-danger-soft p-4 text-sm font-medium text-danger">
          No se pudo cargar el inventario. Probá recargar la página.
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-[var(--radius-card)] bg-surface p-10 text-center shadow-sm">
          <p className="font-semibold">{hasFilters ? "No hay resultados con esos filtros" : "Todavía no hay productos cargados"}</p>
          <p className="mt-1 text-sm text-muted">
            {hasFilters
              ? "Probá con otra búsqueda o limpiá los filtros."
              : isAdmin
                ? "Creá el primero con el botón “Nuevo producto”."
                : "Pedile al administrador que cargue los productos."}
          </p>
        </div>
      ) : (
        <>
          <StockTable rows={rows} canManage={isAdmin} showCost={isAdmin} />
          <Pagination basePath="/admin/stock" page={page} pageSize={PAGE_SIZE} total={totalRows} params={filterParams} />
        </>
      )}
    </div>
  );
}
