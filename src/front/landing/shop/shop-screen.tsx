import Link from "next/link";
import { EmptyState } from "@/front/shared/ui/empty-state";
import { Pagination } from "@/front/shared/ui/pagination";
import { activeFilterCount, shopQuery } from "@/shared/shop-filters";
import type { PublicCategory, PublicProduct, PublicPromotion, ShopFacets, ShopFilters } from "@/shared/types";
import { ProductGrid } from "../catalog/product-card";
import { ActiveFilters } from "./active-filters";
import { ShopLayout } from "./shop-layout";
import { ShopSearch } from "./shop-search";

/**
 * /tienda: catálogo con filtros laterales generados desde la base (categoría, marca, precio,
 * opciones de variante, ofertas y stock). Los filtros viajan en la URL (se pueden compartir).
 */
export function ShopScreen({
  list,
  filters,
  facets,
  categories,
  promotion,
  pageSize,
}: {
  list: { rows: PublicProduct[]; total: number };
  filters: ShopFilters;
  facets: ShopFacets;
  categories: PublicCategory[];
  /** La promoción vigente que se está viendo (?promo=...), si hay. */
  promotion: PublicPromotion | null;
  pageSize: number;
}) {
  const current = categories.find((c) => c.slug === filters.category);
  const title = filters.promo ? (promotion?.name ?? "Promoción") : filters.offers ? "Ofertas" : (current?.name ?? "Tienda");
  // Los mismos filtros, sin la página, para los links del paginador
  const params = Object.fromEntries(new URLSearchParams(shopQuery(filters, { page: 1 })));
  const hasFilters = Boolean(filters.q) || activeFilterCount(filters) > 0;

  return (
    <div className="mx-auto max-w-[85rem] px-4 pb-16 pt-10 sm:px-6">
      <nav aria-label="Ubicación" className="text-sm text-muted">
        <Link href="/" className="hover:text-primary">
          Inicio
        </Link>{" "}
        <span aria-hidden>/</span> <span>{title}</span>
      </nav>

      <ShopLayout title={title} total={list.total} filters={filters} facets={facets}>
        {promotion?.description && <p className="mb-4 max-w-2xl text-muted">{promotion.description}</p>}
        <ShopSearch key={filters.q} filters={filters} />
        <div className="mt-4">
          <ActiveFilters filters={filters} facets={facets} promoName={promotion?.name ?? null} />
        </div>

        <div className="mt-6">
          {list.rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? "No encontramos productos con esos filtros" : "Todavía no hay productos"}
              text={hasFilters ? "Probá sacando algún filtro o con otra búsqueda." : "Volvé pronto: estamos cargando el catálogo."}
            />
          ) : (
            <>
              <ProductGrid products={list.rows} columns={3} />
              <Pagination basePath="/tienda" page={filters.page} pageSize={pageSize} total={list.total} params={params} />
            </>
          )}
        </div>
      </ShopLayout>
    </div>
  );
}
