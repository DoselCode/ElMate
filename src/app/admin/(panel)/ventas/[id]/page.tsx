import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/back/admin/auth/session";
import { getSaleDetail } from "@/back/admin/sales/queries";
import { SaleDetailScreen } from "@/front/admin/sales/sale-detail";

export const metadata: Metadata = { title: "Ticket de venta" };

export default async function SaleDetailPage({ params }: PageProps<"/admin/ventas/[id]">) {
  const { id } = await params;
  const [user, detail] = await Promise.all([requireStaff(), getSaleDetail(id)]);
  if (!detail) notFound();
  return <SaleDetailScreen detail={detail} isAdmin={user.role === "admin"} />;
}
