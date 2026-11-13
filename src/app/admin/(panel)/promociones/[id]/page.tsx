import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPromotionForEdit } from "@/back/admin/promotions/queries";
import { PromotionForm } from "@/front/admin/promotions/promotion-form";

export const metadata: Metadata = { title: "Editar promoción" };

export default async function EditPromotionPage({ params }: PageProps<"/admin/promociones/[id]">) {
  const { id } = await params;
  const promotion = await getPromotionForEdit(id);
  if (!promotion) notFound();
  return <PromotionForm key={promotion.id} initial={promotion} />;
}
