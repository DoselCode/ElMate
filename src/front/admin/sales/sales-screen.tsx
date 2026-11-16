import Link from "next/link";
import { Receipt, ShoppingCart } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/front/shared/ui/badge";
import { buttonClass } from "@/front/shared/ui/button";
import { EmptyState, LoadError } from "@/front/shared/ui/empty-state";
import { Pagination } from "@/front/shared/ui/pagination";
import { formatDateTime, formatMoney } from "@/shared/format";
import { SALES_PAGE_SIZE } from "@/shared/query";
import { SalesFilterBar } from "./sales-filters";
import type { Paged, PaymentMethod, SaleRow, SalesFilters, SalesTotals } from "@/shared/types";

const day = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", timeZone: "UTC" });
const label = (d: string) => day.format(new Date(`${d}T00:00:00Z`));

/** Historial de ventas: filtros por fecha, forma de pago y estado, con los totales del período. */
export function SalesScreen({
  list,
  filters,
  methods,
  today,
}: {
  list: Paged<SaleRow> & { totals: SalesTotals };
  filters: SalesFilters;
  methods: PaymentMethod[];
  today: string;
}) {
  const { from, to, method, status, page } = filters;
  const isToday = from === today && to === today;
  const period = from === to ? (isToday ? "hoy" : `el ${label(from)}`) : `del ${label(from)} al ${label(to)}`;
  const filterParams = { from, to, method, status };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Ventas</h1>
        <Link href="/admin/ventas/nueva" className={buttonClass("primary")}>
          <ShoppingCart size={18} weight="bold" aria-hidden /> Nueva venta
        </Link>
      </header>

      <SalesFilterBar filters={filters} methods={methods} today={today} showReset={!isToday || Boolean(method) || Boolean(status)} />

      {status !== "anulada" && (
        <section aria-label="Totales del período" className="rounded-[var(--radius-card)] bg-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm text-muted">
              Vendido {period} · {list.totals.count} {list.totals.count === 1 ? "venta" : "ventas"}
            </p>
            <p className="font-display text-3xl font-bold tabular-nums">{formatMoney(list.totals.total)}</p>
          </div>
          {list.totals.byMethod.length > 1 && (
            <ul className="mt-3 flex flex-wrap gap-2 text-sm">
              {list.totals.byMethod.map((m) => (
                <li key={m.name} className="rounded-full bg-background px-3 py-1">
                  {m.name}: <strong className="tabular-nums">{formatMoney(m.total)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {list.error ? (
        <LoadError text="No se pudieron cargar las ventas. Probá recargar la página." />
      ) : list.rows.length === 0 ? (
        <EmptyState title={`No hay ventas ${period}`} text="Cambiá las fechas o los filtros para ver otras." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-[var(--radius-card)] bg-surface shadow-sm">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <caption className="sr-only">Ventas {period}</caption>
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-5 py-3.5 font-bold">Ticket</th>
                  <th scope="col" className="px-3 py-3.5 font-bold">Productos</th>
                  <th scope="col" className="px-3 py-3.5 font-bold">Forma de pago</th>
                  <th scope="col" className="px-3 py-3.5 text-right font-bold">Total</th>
                  <th scope="col" className="px-5 py-3.5 font-bold">Estado</th>
                  <th scope="col" className="px-5 py-3.5 text-right font-bold"><span className="sr-only">Ticket</span></th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((s) => (
                  <tr key={s.id} className="border-b border-dashed border-border last:border-0 hover:bg-background/60">
                    <td className="px-5 py-3">
                      <Link href={`/admin/ventas/${s.id}`} className="font-semibold text-primary hover:underline">
                        N° {s.ticket_number}
                      </Link>
                      <p className="text-xs text-muted">
                        {formatDateTime(s.created_at)}
                        {s.seller_name && ` · ${s.seller_name}`}
                      </p>
                    </td>
                    <td className="max-w-80 px-3 py-3">
                      <p className="truncate">{s.summary}</p>
                      {s.customer_name && <p className="truncate text-xs text-muted">Cliente: {s.customer_name}</p>}
                    </td>
                    <td className="px-3 py-3">{s.payment_method_name}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatMoney(s.total)}</td>
                    <td className="px-5 py-3">
                      {s.status === "pagada" ? <Badge tone="success">Pagada</Badge> : <Badge tone="danger">Anulada</Badge>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/admin/ventas/${s.id}`}
                        aria-label={`Ver ticket N° ${s.ticket_number}`}
                        className={buttonClass("secondary", "sm")}
                      >
                        <Receipt size={16} aria-hidden /> Ver ticket
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination basePath="/admin/ventas" page={page} pageSize={SALES_PAGE_SIZE} total={list.total} params={filterParams} alwaysShow />
        </>
      )}
    </div>
  );
}
