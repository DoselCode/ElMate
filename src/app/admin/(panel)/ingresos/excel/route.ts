import type { NextRequest } from "next/server";
import { incomeSheet } from "@/back/admin/excel";
import { getIncomeReport, incomeYearParam } from "@/back/admin/sales/queries";
import { buildXlsx, xlsxResponse } from "@/back/shared/xlsx";
import { STAGE_2 } from "@/shared/features";

/** GET /admin/ingresos/excel?year=2026 → ingresos del año mes por mes, en .xlsx. Solo admin. */
export async function GET(request: NextRequest) {
  if (!STAGE_2) return new Response(null, { status: 404 }); // entrega final (shared/features.ts)
  const year = incomeYearParam(Object.fromEntries(request.nextUrl.searchParams));
  const report = await getIncomeReport(year); // valida que sea admin
  return xlsxResponse(buildXlsx(incomeSheet(year, report.months)), `ingresos-${year}.xlsx`);
}
