import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { SummarySkeleton, TableSkeleton } from "@/front/admin/layout/panel-loading";
import { buttonClass } from "@/front/shared/ui/button";
import { EmptyState, LoadError } from "@/front/shared/ui/empty-state";
import { inputClass } from "@/front/shared/ui/field";
import { FilterField } from "@/front/shared/ui/filter-field";
import { Pagination } from "@/front/shared/ui/pagination";
import { PAGE_SIZE } from "@/shared/query";
import type { Option, Paged, StockFilters, StockRow, StockSummary } from "@/shared/types";
import { StockTable } from "./stock-table";

/**
 * Pantalla de inventario: resumen, filtros y tabla. El título y los filtros se ven al instante; el
 * resumen y la tabla llegan como promesas (back/admin/stock/queries) y aparecen apenas están listos,
 * cada uno por su cuenta, sin esperar al más lento.
 */
export function StockScreen({
  list,
  summary,
  filters,
  categories,
  suppliers,
  isAdmin,
  saved,
}: {
  list: Promise<Paged<StockRow>>;
  summary: Promise<StockSummary>;
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

      <Suspense fallback={<SummarySkeleton />}>
        <SummaryCards summary={summary} />
      </Suspense>

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

      {/* key: al cambiar un filtro o de página vuelve a mostrar el esqueleto mientras llegan las filas */}
      <Suspense key={JSON.stringify(filters)} fallback={<TableSkeleton />}>
        <StockResults list={list} hasFilters={hasFilters} isAdmin={isAdmin} page={page} filterParams={filterParams} />
      </Suspense>
    </div>
  );
}

async function SummaryCards({ summary }: { summary: Promise<StockSummary> }) {
  const s = await summary;
  return (
    <section aria-label="Resumen" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <SummaryCard label="Variantes activas" value={s.total} href="/admin/stock" />
      <SummaryCard label="Stock bajo" value={s.low} href="/admin/stock?status=low" tone="warning" />
      <SummaryCard label="Sin stock" value={s.out} href="/admin/stock?status=out" tone="danger" />
    </section>
  );
}

async function StockResults({
  list: pending,
  hasFilters,
  isAdmin,
  page,
  filterParams,
}: {
  list: Promise<Paged<StockRow>>;
  hasFilters: boolean;
  isAdmin: boolean;
  page: number;
  filterParams: Record<string, string | undefined>;
}) {
  const list = await pending;
  if (list.error) return <LoadError text="No se pudo cargar el inventario. Probá recargar la página." />;
  if (list.rows.length === 0) {
    return (
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
    );
  }
  return (
    <>
      <StockTable rows={list.rows} canManage={isAdmin} showCost={isAdmin} />
      <Pagination basePath="/admin/stock" page={page} pageSize={PAGE_SIZE} total={list.total} params={filterParams} />
    </>
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
