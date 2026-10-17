import Link from "next/link";
import { Badge } from "@/front/shared/ui/badge";
import { buttonClass } from "@/front/shared/ui/button";
import { EmptyState, LoadError } from "@/front/shared/ui/empty-state";
import { inputClass } from "@/front/shared/ui/field";
import { FilterField } from "@/front/shared/ui/filter-field";
import { Pagination } from "@/front/shared/ui/pagination";
import { formatDateTime, formatQuantity } from "@/shared/format";
import { PAGE_SIZE } from "@/shared/query";
import type { MovementFilters, MovementRow, MovementType, Paged } from "@/shared/types";

const TYPES: Record<MovementType, { label: string; tone: "success" | "neutral" | "warning" }> = {
  ingreso: { label: "Ingreso", tone: "success" },
  venta: { label: "Venta", tone: "neutral" },
  ajuste: { label: "Ajuste", tone: "warning" },
  anulacion: { label: "Anulación", tone: "neutral" },
};

/** Historial de movimientos de stock. Recibe los datos ya cargados desde back/admin/stock/queries. */
export function MovementsScreen({ list, filters }: { list: Paged<MovementRow>; filters: MovementFilters }) {
  const { q, type, page } = filters;
  const hasFilters = Boolean(q || type);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Movimientos de stock</h1>
        <p className="mt-1 text-sm text-muted">
          Registro de todo lo que entró y salió. No se puede editar ni borrar: las correcciones se hacen con un ajuste.
        </p>
      </header>

      <form method="get" action="/admin/stock/movements" className="flex flex-wrap items-end gap-3" role="search">
        <FilterField id="q" label="Buscar" className="min-w-56 flex-1">
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Producto o código" className={inputClass} />
        </FilterField>
        <FilterField id="type" label="Tipo">
          <select id="type" name="type" defaultValue={type} className={inputClass}>
            <option value="">Todos</option>
            {Object.entries(TYPES).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </FilterField>
        <button type="submit" className={buttonClass("primary")}>
          Filtrar
        </button>
        {hasFilters && (
          <Link href="/admin/stock/movements" className={buttonClass("ghost")}>
            Limpiar
          </Link>
        )}
      </form>

      {list.error ? (
        <LoadError text="No se pudo cargar el historial. Probá recargar la página." />
      ) : list.rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No hay movimientos con esos filtros" : "Todavía no hay movimientos"}
          text="Los ingresos, ventas y ajustes de stock van a aparecer acá."
        />
      ) : (
        <>
          <MovementsTable rows={list.rows} />
          <Pagination basePath="/admin/stock/movements" page={page} pageSize={PAGE_SIZE} total={list.total} params={{ q, type }} />
        </>
      )}
    </div>
  );
}

function MovementsTable({ rows }: { rows: MovementRow[] }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] bg-surface shadow-sm">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <caption className="sr-only">Historial de movimientos de stock</caption>
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <th scope="col" className="px-5 py-3.5 font-bold">Fecha</th>
            <th scope="col" className="px-3 py-3.5 font-bold">Producto</th>
            <th scope="col" className="px-3 py-3.5 font-bold">Tipo</th>
            <th scope="col" className="px-3 py-3.5 text-right font-bold">Cantidad</th>
            <th scope="col" className="px-3 py-3.5 text-right font-bold">Stock resultante</th>
            <th scope="col" className="px-3 py-3.5 font-bold">Detalle</th>
            <th scope="col" className="px-5 py-3.5 font-bold">Usuario</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-b border-dashed border-border last:border-0">
              <td className="whitespace-nowrap px-5 py-3 text-muted">{formatDateTime(m.created_at)}</td>
              <td className="px-3 py-3">
                <p className="font-semibold">{m.product_name}</p>
                <p className="text-xs text-muted">
                  {m.variant_label && <span>{m.variant_label} · </span>}
                  <span className="font-mono">{m.sku}</span>
                </p>
              </td>
              <td className="px-3 py-3">
                <Badge tone={TYPES[m.type].tone}>{TYPES[m.type].label}</Badge>
              </td>
              <td className={`px-3 py-3 text-right font-semibold tabular-nums ${m.quantity > 0 ? "text-success" : "text-danger"}`}>
                {formatQuantity(m.quantity, m.unit, { signed: true })}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">{formatQuantity(m.stock_after, m.unit)}</td>
              <td className="px-3 py-3 text-muted">
                {m.ticket_number ? `Ticket #${m.ticket_number}` : m.reason || "—"}
                {m.ticket_number && m.reason ? ` · ${m.reason}` : ""}
              </td>
              <td className="px-5 py-3 text-muted">{m.created_by_name ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
