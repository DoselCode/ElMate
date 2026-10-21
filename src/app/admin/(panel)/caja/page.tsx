import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCashState, getClosedSessions } from "@/back/admin/sales/queries";
import { CashScreen } from "@/front/admin/sales/cash-screen";
import { STAGE_2 } from "@/shared/features";

export const metadata: Metadata = { title: "Caja" };

export default async function CashPage() {
  if (!STAGE_2) notFound(); // entrega final (shared/features.ts)
  const [state, history] = await Promise.all([getCashState(), getClosedSessions()]);
  return <CashScreen state={state} history={history} />;
}
