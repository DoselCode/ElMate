import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSales, parseSalesFilters, todayAR } from "@/back/admin/sales/queries";
import { getPaymentMethods } from "@/back/admin/settings/queries";
import { SalesScreen } from "@/front/admin/sales/sales-screen";
import { STAGE_2 } from "@/shared/features";

export const metadata: Metadata = { title: "Ventas" };

export default async function SalesPage({ searchParams }: PageProps<"/admin/ventas">) {
  if (!STAGE_2) notFound(); // entrega final (shared/features.ts)
  const filters = parseSalesFilters(await searchParams);
  const [list, methods] = await Promise.all([getSales(filters), getPaymentMethods(true)]);
  return <SalesScreen list={list} filters={filters} methods={methods} today={todayAR()} />;
}
