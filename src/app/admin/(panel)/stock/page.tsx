import type { Metadata } from "next";
import { requireStaff } from "@/back/admin/auth/session";
import { getCatalogOptions, getStockList, getStockSummary, parseStockFilters } from "@/back/admin/stock/queries";
import { StockScreen } from "@/front/admin/stock/stock-screen";
import { param } from "@/shared/query";

export const metadata: Metadata = { title: "Inventario y stock" };

export default async function StockPage({ searchParams }: PageProps<"/admin/stock">) {
  const sp = await searchParams;
  const filters = parseStockFilters(sp);

  // La tabla y el resumen se piden ya pero no se esperan: StockScreen los muestra apenas llegan
  const list = getStockList(filters);
  const summary = getStockSummary();
  // Si un permiso falla (redirect) antes de mostrarlos, no queda una promesa rechazada sin atender
  list.catch(() => {});
  summary.catch(() => {});
  const [user, { categories, suppliers }] = await Promise.all([requireStaff(), getCatalogOptions()]);

  return (
    <StockScreen
      list={list}
      summary={summary}
      filters={filters}
      categories={categories}
      suppliers={suppliers}
      isAdmin={user.role === "admin"}
      saved={param(sp, "saved") === "1"}
    />
  );
}
