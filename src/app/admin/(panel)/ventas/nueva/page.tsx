import type { Metadata } from "next";
import { getCashState, getSellables } from "@/back/admin/sales/queries";
import { getPaymentMethods } from "@/back/admin/settings/queries";
import { PosScreen } from "@/front/admin/sales/pos-screen";

export const metadata: Metadata = { title: "Nueva venta" };

export default async function NewSalePage() {
  const [items, methods, cash] = await Promise.all([getSellables(), getPaymentMethods(), getCashState()]);
  return <PosScreen items={items} methods={methods} cashOpen={cash.open !== null} />;
}
