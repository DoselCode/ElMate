import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCashState, getSellables } from "@/back/admin/sales/queries";
import { getPaymentMethods } from "@/back/admin/settings/queries";
import { PosScreen } from "@/front/admin/sales/pos-screen";
import { STAGE_2 } from "@/shared/features";

export const metadata: Metadata = { title: "Nueva venta" };

export default async function NewSalePage() {
  if (!STAGE_2) notFound(); // entrega final (shared/features.ts)
  const [items, methods, cash] = await Promise.all([getSellables(), getPaymentMethods(), getCashState()]);
  return <PosScreen items={items} methods={methods} cashOpen={cash.open !== null} />;
}
