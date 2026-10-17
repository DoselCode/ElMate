import Link from "next/link";
import { Badge } from "@/front/shared/ui/badge";
import { formatMoney } from "@/shared/format";
import type { IncomeMonth } from "@/shared/types";

const monthName = new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "UTC" });
const nameOf = (m: string) => {
  const n = monthName.format(new Date(`${m}T00:00:00Z`));
  return n.charAt(0).toUpperCase() + n.slice(1);
};

/** Ingresos del año mes por mes: ventas del sistema + totales históricos importados del Excel. */
export function IncomeScreen({ year, years, months, currentMonth }: { year: number; years: number[]; months: IncomeMonth[]; currentMonth: string }) {
  const withData = months.filter((m) => m.source !== "sin datos");
  const max = Math.max(1, ...months.map((m) => m.total));
  const totals = months.reduce(
    (t, m) => ({ cash: t.cash + m.cash, other: t.other + m.other, total: t.total + m.total, count: t.count + m.salesCount }),
    { cash: 0, other: 0, total: 0, count: 0 },
  );
  const profitMonths = months.filter((m) => m.cost !== null && m.systemTotal > 0);
  const profit = profitMonths.reduce((s, m) => s + (m.systemTotal - (m.cost ?? 0)), 0);
  const best = withData.reduce<IncomeMonth | null>((b, m) => (b === null || m.total > b.total ? m : b), null);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Ingresos {year}</h1>
        {years.length > 1 && (
          <nav aria-label="Año" className="flex gap-1 rounded-full bg-surface p-1 shadow-sm">
            {years.map((y) => (
              <Link
                key={y}
                href={`/admin/ingresos?year=${y}`}
                aria-current={y === year ? "page" : undefined}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold ${y === year ? "bg-primary text-white" : "text-muted hover:text-foreground"}`}
              >
                {y}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <section aria-label="Resumen del año" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total del año" value={formatMoney(totals.total)} strong />
        <Stat label="En efectivo" value={formatMoney(totals.cash)} />
        <Stat label="Otras formas de pago" value={formatMoney(totals.other)} />
        <Stat label="Mejor mes" value={best ? `${nameOf(best.month)} · ${formatMoney(best.total)}` : "—"} small />
      </section>

      <div className="overflow-x-auto rounded-[var(--radius-card)] bg-surface shadow-sm">
        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
          <caption className="sr-only">Ingresos por mes de {year}</caption>
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-5 py-3.5 font-bold">Mes</th>
              <th scope="col" className="px-3 py-3.5 text-right font-bold">Efectivo</th>
              <th scope="col" className="px-3 py-3.5 text-right font-bold">Otras formas</th>
              <th scope="col" className="px-3 py-3.5 text-right font-bold">Total</th>
              <th scope="col" className="w-1/4 px-3 py-3.5 font-bold"><span className="sr-only">Comparación</span></th>
              <th scope="col" className="px-3 py-3.5 text-right font-bold">Ganancia</th>
              <th scope="col" className="px-5 py-3.5 font-bold">Datos</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => {
              const empty = m.source === "sin datos";
              const future = m.month > currentMonth;
              const margin = m.cost !== null && m.systemTotal > 0 ? m.systemTotal - m.cost : null;
              return (
                <tr key={m.month} className={`border-b border-dashed border-border last:border-0 ${empty ? "text-muted" : ""}`}>
                  <th scope="row" className="px-5 py-3 font-semibold">
                    {nameOf(m.month)}
                    {m.byMethod.length > 0 && (
                      <span className="block text-xs font-normal text-muted">
                        {m.byMethod.map((b) => `${b.name} ${formatMoney(b.total)}`).join(" · ")}
                      </span>
                    )}
                  </th>
                  <td className="px-3 py-3 text-right tabular-nums">{empty ? "—" : formatMoney(m.cash)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{empty ? "—" : formatMoney(m.other)}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums">{empty ? "—" : formatMoney(m.total)}</td>
                  <td className="px-3 py-3" aria-hidden>
                    {!empty && (
                      <div className="flex h-2.5 overflow-hidden rounded-full bg-background">
                        <span className="bg-primary" style={{ width: `${(m.cash / max) * 100}%` }} />
                        <span className="bg-accent/70" style={{ width: `${(m.other / max) * 100}%` }} />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{margin === null ? "—" : formatMoney(margin)}</td>
                  <td className="px-5 py-3">
                    {m.source === "historial" && <Badge tone="neutral">Excel</Badge>}
                    {m.source === "sistema" && <Badge tone="success">Sistema · {m.salesCount}</Badge>}
                    {m.source === "ambos" && <Badge tone="warning">Excel + sistema</Badge>}
                    {empty && !future && <span className="text-xs">Sin datos</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-bold">
              <th scope="row" className="px-5 py-3.5">Total</th>
              <td className="px-3 py-3.5 text-right tabular-nums">{formatMoney(totals.cash)}</td>
              <td className="px-3 py-3.5 text-right tabular-nums">{formatMoney(totals.other)}</td>
              <td className="px-3 py-3.5 text-right tabular-nums">{formatMoney(totals.total)}</td>
              <td />
              <td className="px-3 py-3.5 text-right tabular-nums">{profitMonths.length ? formatMoney(profit) : "—"}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" aria-hidden /> Efectivo</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-accent/70" aria-hidden /> Débito, crédito, transferencia y QR</span>
        <span>
          Los meses marcados “Excel” vienen de la planilla de ingresos (solo totales). La ganancia se calcula con las ventas
          cargadas en el sistema: total cobrado menos el costo de lo vendido.
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value, strong = false, small = false }: { label: string; value: string; strong?: boolean; small?: boolean }) {
  return (
    <div className={`rounded-[var(--radius-card)] p-5 shadow-sm ${strong ? "bg-primary text-white" : "bg-surface"}`}>
      <p className={`text-xs font-bold uppercase tracking-wide ${strong ? "text-white/80" : "text-muted"}`}>{label}</p>
      <p className={`mt-1 font-extrabold tabular-nums ${small ? "text-lg" : "text-2xl"}`}>{value}</p>
    </div>
  );
}
