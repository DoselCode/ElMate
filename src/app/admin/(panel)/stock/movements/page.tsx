import type { Metadata } from "next";
import { getMovements, parseMovementFilters } from "@/back/admin/stock/queries";
import { MovementsScreen } from "@/front/admin/stock/movements-screen";

export const metadata: Metadata = { title: "Movimientos de stock" };

export default async function MovementsPage({ searchParams }: PageProps<"/admin/stock/movements">) {
  const filters = parseMovementFilters(await searchParams);
  const list = await getMovements(filters);
  return <MovementsScreen list={list} filters={filters} />;
}
