import type { Metadata } from "next";
import { requireAdmin } from "@/back/admin/auth/session";
import { getIncomeReport, todayAR } from "@/back/admin/sales/queries";
import { IncomeScreen } from "@/front/admin/sales/income-screen";
import { param } from "@/shared/query";

export const metadata: Metadata = { title: "Ingresos" };

export default async function IncomePage({ searchParams }: PageProps<"/admin/ingresos">) {
  const today = todayAR();
  const requested = Number.parseInt(param(await searchParams, "year"), 10);
  const year = Number.isFinite(requested) && requested >= 2000 && requested <= 2100 ? requested : Number(today.slice(0, 4));
  const [, report] = await Promise.all([requireAdmin(), getIncomeReport(year)]);
  return <IncomeScreen year={year} years={report.years} months={report.months} currentMonth={`${today.slice(0, 7)}-01`} />;
}
