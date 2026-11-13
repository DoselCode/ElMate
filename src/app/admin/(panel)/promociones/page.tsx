import type { Metadata } from "next";
import { listPromotions } from "@/back/admin/promotions/queries";
import { PromotionsScreen } from "@/front/admin/promotions/promotions-screen";

export const metadata: Metadata = { title: "Promociones" };

export default async function PromotionsPage() {
  return <PromotionsScreen promotions={await listPromotions()} />;
}
