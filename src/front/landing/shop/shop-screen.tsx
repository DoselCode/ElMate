import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { EmptyState } from "@/front/shared/ui/empty-state";
import { Pagination } from "@/front/shared/ui/pagination";
import { buildQuery } from "@/shared/query";
import type { PublicCategory, PublicProduct, ShopFilters, ShopSort } from "@/shared/types";
import { ProductGrid } from "../catalog/product-card";

const SORT_LABELS: Record<ShopSort, string> = {
  destacados: "Destacados",
  "precio-asc": "Menor precio",
  "precio-desc": "Mayor precio",
  nuevos: "Más nuevos",
};

/** /tienda: catálogo con categorías, búsqueda, orden y ofertas. Los filtros viajan en la URL (se pueden compartir). */
export function ShopScreen({
  list,
  filters,
  categories,
  pageSize,
}: {
  list: { rows: PublicProduct[]; total: number };
  filters: ShopFilters;
  categories: PublicCategory[];
  pageSize: number;
}) {
  const current = categories.find((c) => c.slug === filters.category);
  const title = filters.offers ? "Ofertas" : (current?.name ?? "Tienda");
  const params = {
    q: filters.q,
    categoria: filters.category,
    orden: filters.sort === "destacados" ? undefined : filters.sort,
    ofertas: filters.offers ? "1" : undefined,
  };
  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-colors ${
      active ? "bg-primary text-white" : "bg-surface text-foreground hover:bg-primary-soft hover:text-primary"
    }`;
  const hasFilters = Boolean(filters.q || filters.category || filters.offers);

  return (
    <div className="mx-auto max-w-[85rem] px-4 pt-10 sm:px-6">
      <nav aria-label="Ubicación" className="text-sm text-muted">
        <Link href="/" className="hover:text-primary">Inicio</Link> <span aria-hidden>/</span> <span>{title}</span>
      </nav>
      <header className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold">{title}</h1>
          <p className="mt-1 text-muted">
            {list.total} {list.total === 1 ? "producto" : "productos"}
            {filters.q && <> para “{filters.q}”</>}
          </p>
        </div>
      </header>

      <nav aria-label="Categorías" className="-mx-1 mt-6 flex gap-2 overflow-x-auto px-1 pb-1">
        <Link href={`/tienda${buildQuery({ ...params, categoria: undefined })}`} className={chip(!filters.category)} aria-current={!filters.category ? "page" : undefined}>
          Todo
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/tienda${buildQuery({ ...params, categoria: c.slug })}`}
            className={chip(c.slug === filters.category)}
            aria-current={c.slug === filters.category ? "page" : undefined}
          >
            {c.name}
          </Link>
        ))}
      </nav>

      <form method="get" action="/tienda" role="search" className="mt-5 flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] bg-surface p-3 shadow-sm">
        {filters.category && <input type="hidden" name="categoria" value={filters.category} />}
        <div className="relative min-w-52 flex-1">
          <MagnifyingGlass size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="shop-q" className="sr-only">Buscar productos</label>
          <input
            id="shop-q"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Buscar productos"
            className="w-full rounded-full border border-border-strong bg-background py-2.5 pl-11 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <label htmlFor="shop-sort" className="sr-only">Ordenar por</label>
        <select
          id="shop-sort"
          name="orden"
          defaultValue={filters.sort}
          className="rounded-full border border-border-strong bg-background px-4 py-2.5 text-sm font-semibold focus:border-primary focus:outline-none"
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 px-1 text-sm font-semibold">
          <input type="checkbox" name="ofertas" value="1" defaultChecked={filters.offers} className="size-4 accent-primary" />
          Solo ofertas
        </label>
        <button type="submit" className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white hover:bg-primary-hover">
          Aplicar
        </button>
        {hasFilters && (
          <Link href="/tienda" className="px-2 text-sm font-semibold text-muted underline underline-offset-2 hover:text-primary">
            Limpiar
          </Link>
        )}
      </form>

      <div className="mt-8">
        {list.rows.length === 0 ? (
          <EmptyState
            title={hasFilters ? "No encontramos productos con esos filtros" : "Todavía no hay productos"}
            text={hasFilters ? "Probá con otra búsqueda o mirá todas las categorías." : "Volvé pronto: estamos cargando el catálogo."}
          />
        ) : (
          <>
            <ProductGrid products={list.rows} />
            <Pagination basePath="/tienda" page={filters.page} pageSize={pageSize} total={list.total} params={params} />
          </>
        )}
      </div>
    </div>
  );
}
