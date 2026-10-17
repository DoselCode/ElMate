import type { Metadata } from "next";
import { getSales, parseSalesFilters, todayAR } from "@/back/admin/sales/queries";
import { getPaymentMethods } from "@/back/admin/settings/queries";
import { SalesScreen } from "@/front/admin/sales/sales-screen";

export const metadata: Metadata = { title: "Ventas" };

export default async function SalesPage({ searchParams }: PageProps<"/admin/ventas">) {
  const filters = parseSalesFilters(await searchParams);
  const [list, methods] = await Promise.all([getSales(filters), getPaymentMethods(true)]);
  return <SalesScreen list={list} filters={filters} methods={methods} today={todayAR()} />;
}
