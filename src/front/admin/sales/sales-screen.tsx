import Link from "next/link";
import { ShoppingCart } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/front/shared/ui/badge";
import { buttonClass } from "@/front/shared/ui/button";
import { EmptyState, LoadError } from "@/front/shared/ui/empty-state";
import { inputClass } from "@/front/shared/ui/field";
import { FilterField } from "@/front/shared/ui/filter-field";
import { Pagination } from "@/front/shared/ui/pagination";
import { formatDateTime, formatMoney } from "@/shared/format";
import { PAGE_SIZE } from "@/shared/query";
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

      <form method="get" action="/admin/ventas" className="flex flex-wrap items-end gap-3">
        <FilterField id="from" label="Desde">
          <input id="from" name="from" type="date" defaultValue={from} max={today} className={inputClass} />
        </FilterField>
        <FilterField id="to" label="Hasta">
          <input id="to" name="to" type="date" defaultValue={to} max={today} className={inputClass} />
        </FilterField>
        <FilterField id="method" label="Forma de pago">
          <select id="method" name="method" defaultValue={method} className={inputClass}>
            <option value="">Todas</option>
            {methods.map((m) => (
              <option key={m.id} value={m.name}>{m.name}</option>
            ))}
          </select>
        </FilterField>
        <FilterField id="status" label="Estado">
          <select id="status" name="status" defaultValue={status} className={inputClass}>
            <option value="">Todas</option>
            <option value="pagada">Pagadas</option>
            <option value="anulada">Anuladas</option>
          </select>
        </FilterField>
        <button type="submit" className={buttonClass("primary")}>Filtrar</button>
        {!isToday || method || status ? (
          <Link href="/admin/ventas" className={buttonClass("ghost")}>Ver hoy</Link>
        ) : null}
      </form>

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
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <caption className="sr-only">Ventas {period}</caption>
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-5 py-3.5 font-bold">Ticket</th>
                  <th scope="col" className="px-3 py-3.5 font-bold">Productos</th>
                  <th scope="col" className="px-3 py-3.5 font-bold">Forma de pago</th>
                  <th scope="col" className="px-3 py-3.5 text-right font-bold">Total</th>
                  <th scope="col" className="px-5 py-3.5 font-bold">Estado</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination basePath="/admin/ventas" page={page} pageSize={PAGE_SIZE} total={list.total} params={filterParams} />
        </>
      )}
    </div>
  );
}
