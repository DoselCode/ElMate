import Link from "next/link";
import { EmptyState } from "@/front/shared/ui/empty-state";
import { Pagination } from "@/front/shared/ui/pagination";
import { buildQuery } from "@/shared/query";
import type {
  PublicCategory,
  PublicProduct,
  PublicPromotion,
  ShopFilters,
} from "@/shared/types";
import { ProductGrid } from "../catalog/product-card";
import { CategoryNav } from "./category-nav";
import { ShopFiltersBar } from "./shop-filters";

/** /tienda: catálogo con categorías, búsqueda, orden y ofertas. Los filtros viajan en la URL (se pueden compartir). */
export function ShopScreen({
  list,
  filters,
  categories,
  promotion,
  pageSize,
}: {
  list: { rows: PublicProduct[]; total: number };
  filters: ShopFilters;
  categories: PublicCategory[];
  /** La promoción vigente que se está viendo (?promo=...), si hay. */
  promotion: PublicPromotion | null;
  pageSize: number;
}) {
  const current = categories.find((c) => c.slug === filters.category);
  const title = filters.promo ? (promotion?.name ?? "Promoción") : filters.offers ? "Ofertas" : (current?.name ?? "Tienda");
  const params = {
    q: filters.q,
    categoria: filters.category,
    orden: filters.sort === "destacados" ? undefined : filters.sort,
    ofertas: filters.offers ? "1" : undefined,
    promo: filters.promo || undefined,
  };
  const hasFilters = Boolean(filters.q || filters.category || filters.offers || filters.promo);

  return (
    <>
      <div className="mx-auto max-w-[85rem] px-4 pt-10 sm:px-6">
        <nav aria-label="Ubicación" className="text-sm text-muted">
          <Link href="/" className="hover:text-primary">
            Inicio
          </Link>{" "}
          <span aria-hidden>/</span> <span>{title}</span>
        </nav>
        <header className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold">{title}</h1>
            <p className="mt-1 text-muted">
              {list.total} {list.total === 1 ? "producto" : "productos"}
              {filters.q && <> para “{filters.q}”</>}
            </p>
            {promotion?.description && <p className="mt-2 max-w-2xl text-muted">{promotion.description}</p>}
          </div>
        </header>

        <CategoryNav
          items={[
            {
              id: "all",
              name: "Todo",
              href: `/tienda${buildQuery({ ...params, categoria: undefined })}`,
              active: !filters.category,
            },
            ...categories.map((c) => ({
              id: c.id,
              name: c.name,
              href: `/tienda${buildQuery({ ...params, categoria: c.slug })}`,
              active: c.slug === filters.category,
            })),
          ]}
        />

        <ShopFiltersBar filters={filters} />

        <div className="mt-8">
          {list.rows.length === 0 ? (
            <EmptyState
              title={
                hasFilters
                  ? "No encontramos productos con esos filtros"
                  : "Todavía no hay productos"
              }
              text={
                hasFilters
                  ? "Probá con otra búsqueda o mirá todas las categorías."
                  : "Volvé pronto: estamos cargando el catálogo."
              }
            />
          ) : (
            <>
              <ProductGrid products={list.rows} />
              <Pagination
                basePath="/tienda"
                page={filters.page}
                pageSize={pageSize}
                total={list.total}
                params={params}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
