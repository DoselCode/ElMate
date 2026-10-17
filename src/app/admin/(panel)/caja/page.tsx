import type { Metadata } from "next";
import { getCashState, getClosedSessions } from "@/back/admin/sales/queries";
import { CashScreen } from "@/front/admin/sales/cash-screen";

export const metadata: Metadata = { title: "Caja" };

export default async function CashPage() {
  const [state, history] = await Promise.all([getCashState(), getClosedSessions()]);
  return <CashScreen state={state} history={history} />;
}
