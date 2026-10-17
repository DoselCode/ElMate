import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { buttonClass } from "@/front/shared/ui/button";
import { EmptyState, LoadError } from "@/front/shared/ui/empty-state";
import { inputClass } from "@/front/shared/ui/field";
import { FilterField } from "@/front/shared/ui/filter-field";
import { Pagination } from "@/front/shared/ui/pagination";
import { PAGE_SIZE } from "@/shared/query";
import type { Option, Paged, StockFilters, StockRow, StockSummary } from "@/shared/types";
import { StockTable } from "./stock-table";

/** Pantalla de inventario: resumen, filtros y tabla. Recibe todo ya cargado desde back/admin/stock/queries. */
export function StockScreen({
  list,
  summary,
  filters,
  categories,
  suppliers,
  isAdmin,
  saved,
}: {
  list: Paged<StockRow>;
  summary: StockSummary;
  filters: StockFilters;
  categories: Option[];
  suppliers: Option[];
  isAdmin: boolean;
  saved: boolean;
}) {
  const { q, supplier, category, status, showInactive, page } = filters;
  const hasFilters = Boolean(q || supplier || category || status || showInactive);
  const filterParams = { q, supplier, category, status, inactive: showInactive ? "1" : undefined };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Inventario y stock</h1>
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
        <SummaryCard label="Variantes activas" value={summary.total} href="/admin/stock" />
        <SummaryCard label="Stock bajo" value={summary.low} href="/admin/stock?status=low" tone="warning" />
        <SummaryCard label="Sin stock" value={summary.out} href="/admin/stock?status=out" tone="danger" />
      </section>

      <form method="get" action="/admin/stock" className="flex flex-wrap items-end gap-3" role="search">
        <FilterField id="q" label="Buscar" className="min-w-56 flex-1">
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Nombre, código o código de barras" className={inputClass} />
        </FilterField>
        <FilterField id="category" label="Categoría">
          <select id="category" name="category" defaultValue={category} className={inputClass}>
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </FilterField>
        <FilterField id="supplier" label="Proveedor">
          <select id="supplier" name="supplier" defaultValue={supplier} className={inputClass}>
            <option value="">Todos</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </FilterField>
        <FilterField id="status" label="Stock">
          <select id="status" name="status" defaultValue={status} className={inputClass}>
            <option value="">Todo</option>
            <option value="low">Bajo o agotado</option>
            <option value="out">Sin stock</option>
          </select>
        </FilterField>
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

      {list.error ? (
        <LoadError text="No se pudo cargar el inventario. Probá recargar la página." />
      ) : list.rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No hay resultados con esos filtros" : "Todavía no hay productos cargados"}
          text={
            hasFilters
              ? "Probá con otra búsqueda o limpiá los filtros."
              : isAdmin
                ? "Creá el primero con el botón “Nuevo producto”."
                : "Pedile al administrador que cargue los productos."
          }
        />
      ) : (
        <>
          <StockTable rows={list.rows} canManage={isAdmin} showCost={isAdmin} />
          <Pagination basePath="/admin/stock" page={page} pageSize={PAGE_SIZE} total={list.total} params={filterParams} />
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, href, tone }: { label: string; value: number; href: string; tone?: "danger" | "warning" }) {
  const color = tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <Link href={href} className="rounded-[var(--radius-card)] bg-surface p-5 shadow-sm transition-shadow hover:shadow-md">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-extrabold tabular-nums ${color}`}>{value}</p>
    </Link>
  );
}
