import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { requireStaff } from "@/lib/auth";
import { formatDateTime, formatSigned } from "@/lib/format";
import { PAGE_SIZE, pageParam, param, safeSearch } from "@/lib/query";
import { createClient } from "@/lib/supabase/server";
import type { MovementRow, MovementType } from "@/lib/types";

export const metadata: Metadata = { title: "Movimientos de stock" };

const TYPES: Record<MovementType, { label: string; tone: "success" | "neutral" | "warning" }> = {
  ingreso: { label: "Ingreso", tone: "success" },
  venta: { label: "Venta", tone: "neutral" },
  ajuste: { label: "Ajuste", tone: "warning" },
  anulacion: { label: "Anulación", tone: "neutral" },
};

export default async function MovementsPage({ searchParams }: PageProps<"/admin/stock/movements">) {
  await requireStaff();
  const sp = await searchParams;

  const q = safeSearch(param(sp, "q"));
  const type = param(sp, "type");
  const page = pageParam(sp);

  const supabase = await createClient();
  let query = supabase.from("stock_movement_log").select("*", { count: "exact" });
  if (q) query = query.or(`product_name.ilike.%${q}%,sku.ilike.%${q}%`);
  if (type in TYPES) query = query.eq("type", type);
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const rows = (data ?? []) as MovementRow[];
  const hasFilters = Boolean(q || type);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl font-bold">Movimientos de stock</h1>
        <p className="mt-1 text-sm text-muted">
          Registro de todo lo que entró y salió. No se puede editar ni borrar: las correcciones se hacen con un ajuste.
        </p>
      </header>

      <form method="get" action="/admin/stock/movements" className="flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-56 flex-1">
          <label htmlFor="q" className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
            Buscar
          </label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Producto o código" className={inputClass} />
        </div>
        <div>
          <label htmlFor="type" className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
            Tipo
          </label>
          <select id="type" name="type" defaultValue={type} className={inputClass}>
            <option value="">Todos</option>
            {Object.entries(TYPES).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonClass("primary")}>
          Filtrar
        </button>
        {hasFilters && (
          <Link href="/admin/stock/movements" className={buttonClass("ghost")}>
            Limpiar
          </Link>
        )}
      </form>

      {error ? (
        <p role="alert" className="rounded-xl bg-danger-soft p-4 text-sm font-medium text-danger">
          No se pudo cargar el historial. Probá recargar la página.
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-[var(--radius-card)] bg-surface p-10 text-center shadow-sm">
          <p className="font-semibold">{hasFilters ? "No hay movimientos con esos filtros" : "Todavía no hay movimientos"}</p>
          <p className="mt-1 text-sm text-muted">Los ingresos, ventas y ajustes de stock van a aparecer acá.</p>
        </div>
      ) : (
        <>
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
                      {formatSigned(m.quantity)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{m.stock_after}</td>
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
          <Pagination basePath="/admin/stock/movements" page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={{ q, type }} />
        </>
      )}
    </div>
  );
}
