import type { Metadata } from "next";
import { getMovements, parseMovementFilters } from "@/back/admin/stock/queries";
import { MovementsScreen } from "@/front/admin/stock/movements-screen";

export const metadata: Metadata = { title: "Movimientos de stock" };

export default async function MovementsPage({ searchParams }: PageProps<"/admin/stock/movements">) {
  const filters = parseMovementFilters(await searchParams);
  // Sin await: el título y los filtros se ven al instante y la tabla aparece cuando llega
  const list = getMovements(filters);
  list.catch(() => {});
  return <MovementsScreen list={list} filters={filters} />;
}
