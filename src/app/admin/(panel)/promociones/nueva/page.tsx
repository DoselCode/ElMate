import type { Metadata } from "next";
import { requireAdmin } from "@/back/admin/auth/session";
import { PromotionForm } from "@/front/admin/promotions/promotion-form";

export const metadata: Metadata = { title: "Nueva promoción" };

export default async function NewPromotionPage() {
  await requireAdmin();
  return <PromotionForm />;
}
