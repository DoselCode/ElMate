import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/back/admin/auth/session";
import { getSaleDetail } from "@/back/admin/sales/queries";
import { SaleDetailScreen } from "@/front/admin/sales/sale-detail";
import { STAGE_2 } from "@/shared/features";
import { buildQuery, param } from "@/shared/query";

export const metadata: Metadata = { title: "Ticket de venta" };

export default async function SaleDetailPage({ params, searchParams }: PageProps<"/admin/ventas/[id]">) {
  if (!STAGE_2) notFound(); // entrega final (shared/features.ts)
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  // Los filtros con los que se abrió el ticket desde la lista: "Volver a ventas" vuelve a esa misma lista
  const backQuery = buildQuery(Object.fromEntries(["from", "to", "method", "status", "page"].map((k) => [k, param(sp, k)])));
  const [user, detail] = await Promise.all([requireStaff(), getSaleDetail(id)]);
  if (!detail) notFound();
  return <SaleDetailScreen detail={detail} isAdmin={user.role === "admin"} backHref={`/admin/ventas${backQuery}`} />;
}
