import type { XlsxSheet } from "@/back/shared/xlsx";
import type { IncomeMonth, MovementRow, MovementType } from "@/shared/types";

/** Planillas que se descargan desde el panel. Funciones puras: reciben las filas ya leídas. */

const MOVEMENT_LABELS: Record<MovementType, string> = {
  ingreso: "Ingreso",
  venta: "Venta",
  ajuste: "Ajuste",
  anulacion: "Anulación",
};

const SOURCE_LABELS: Record<IncomeMonth["source"], string> = {
  sistema: "Sistema",
  historial: "Excel",
  ambos: "Excel + sistema",
  "sin datos": "Sin datos",
};

const monthName = new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "UTC" });
const nameOf = (m: string) => {
  const n = monthName.format(new Date(`${m}T00:00:00Z`));
  return n.charAt(0).toUpperCase() + n.slice(1);
};

export function movementsSheet(rows: MovementRow[]): XlsxSheet {
  return {
    name: "Movimientos",
    columns: [
      { header: "Fecha", format: "datetime", width: 17 },
      { header: "Producto", width: 34 },
      { header: "Variante", width: 18 },
      { header: "SKU", width: 14 },
      { header: "Tipo", width: 11 },
      { header: "Cantidad", format: "number", width: 10 },
      { header: "Unidad", width: 8 },
      { header: "Stock resultante", format: "number", width: 15 },
      { header: "Ticket", format: "number", width: 9 },
      { header: "Motivo", width: 34 },
      { header: "Usuario", width: 20 },
    ],
    rows: rows.map((m) => [
      new Date(m.created_at),
      m.product_name,
      m.variant_label,
      m.sku,
      MOVEMENT_LABELS[m.type] ?? m.type,
      Number(m.quantity),
      m.unit === "kg" ? "kg" : "unidad",
      Number(m.stock_after),
      m.ticket_number,
      m.reason,
      m.created_by_name,
    ]),
  };
}

/** Un mes por fila, con una columna por cada forma de pago que aparece en el año. */
export function incomeSheet(year: number, months: IncomeMonth[]): XlsxSheet {
  const methods = [...new Set(months.flatMap((m) => m.byMethod.map((b) => b.name)))].sort((a, b) => a.localeCompare(b, "es"));
  const marginOf = (m: IncomeMonth) => (m.cost !== null && m.systemTotal > 0 ? m.systemTotal - m.cost : null);
  const sum = (pick: (m: IncomeMonth) => number) => Math.round(months.reduce((s, m) => s + pick(m), 0) * 100) / 100;
  const margins = months.map(marginOf).filter((v): v is number => v !== null);

  return {
    name: `Ingresos ${year}`,
    columns: [
      { header: "Mes", width: 13 },
      { header: "Efectivo", format: "money", width: 15 },
      { header: "Otras formas", format: "money", width: 15 },
      { header: "Total", format: "money", width: 15 },
      { header: "Ganancia", format: "money", width: 15 },
      { header: "Ventas del sistema", format: "number", width: 12 },
      { header: "Datos", width: 15 },
      ...methods.map((name) => ({ header: name, format: "money" as const, width: 15 })),
    ],
    rows: months.map((m) => {
      const empty = m.source === "sin datos";
      return [
        nameOf(m.month),
        empty ? null : m.cash,
        empty ? null : m.other,
        empty ? null : m.total,
        marginOf(m),
        m.salesCount || null,
        SOURCE_LABELS[m.source],
        ...methods.map((name) => m.byMethod.find((b) => b.name === name)?.total ?? null),
      ];
    }),
    footer: [
      "Total",
      sum((m) => m.cash),
      sum((m) => m.other),
      sum((m) => m.total),
      margins.length ? Math.round(margins.reduce((s, v) => s + v, 0) * 100) / 100 : null,
      sum((m) => m.salesCount) || null,
      null,
      ...methods.map((name) => sum((m) => m.byMethod.find((b) => b.name === name)?.total ?? 0)),
    ],
  };
}
