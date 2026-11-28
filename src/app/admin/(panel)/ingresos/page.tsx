import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/back/admin/auth/session";
import { getIncomeReport, incomeYearParam, todayAR } from "@/back/admin/sales/queries";
import { IncomeScreen } from "@/front/admin/sales/income-screen";
import { STAGE_2 } from "@/shared/features";

export const metadata: Metadata = { title: "Ingresos" };

export default async function IncomePage({ searchParams }: PageProps<"/admin/ingresos">) {
  if (!STAGE_2) notFound(); // entrega final (shared/features.ts)
  const today = todayAR();
  const year = incomeYearParam(await searchParams, today);
  const [, report] = await Promise.all([requireAdmin(), getIncomeReport(year)]);
  return <IncomeScreen year={year} years={report.years} months={report.months} currentMonth={`${today.slice(0, 7)}-01`} />;
}
