import type { NextRequest } from "next/server";
import { movementsSheet } from "@/back/admin/excel";
import { todayAR } from "@/back/admin/sales/queries";
import { getMovementsForExport, parseMovementFilters } from "@/back/admin/stock/queries";
import { buildXlsx, xlsxResponse } from "@/back/shared/xlsx";

/** GET /admin/stock/movements/excel?q=…&type=… → todos los movimientos con esos filtros, en .xlsx. Solo admin. */
export async function GET(request: NextRequest) {
  const filters = parseMovementFilters(Object.fromEntries(request.nextUrl.searchParams));
  const { rows, error } = await getMovementsForExport(filters);
  if (error) return new Response("No se pudo generar el Excel. Probá de nuevo.", { status: 500 });
  return xlsxResponse(buildXlsx(movementsSheet(rows)), `movimientos-stock-${todayAR()}.xlsx`);
}
