"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buttonClass } from "@/front/shared/ui/button";
import { inputClass } from "@/front/shared/ui/field";
import { FilterField } from "@/front/shared/ui/filter-field";
import { buildQuery } from "@/shared/query";
import type { PaymentMethod, SalesFilters } from "@/shared/types";

type Values = Pick<SalesFilters, "from" | "to" | "method" | "status">;

/**
 * Filtros del historial de ventas. No hay botón "Filtrar": al cambiar una fecha o un filtro se
 * actualiza la URL y la lista se vuelve a cargar sola (siempre desde la página 1).
 */
export function SalesFilterBar({
  filters,
  methods,
  today,
  showReset,
}: {
  filters: SalesFilters;
  methods: PaymentMethod[];
  today: string;
  showReset: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Values>(filters);
  const [seen, setSeen] = useState(filters);

  // Si la URL cambia desde afuera (ej: "Ver hoy"), los campos la siguen
  if (seen !== filters) {
    setSeen(filters);
    setValues(filters);
  }

  function apply(next: Values) {
    setValues(next);
    // Con una fecha borrada o incompleta no se busca todavía
    if (!next.from || !next.to) return;
    const query = buildQuery({ from: next.from, to: next.to, method: next.method, status: next.status });
    startTransition(() => router.replace(`${pathname}${query}`, { scroll: false }));
  }

  // Si el rango queda al revés, la otra fecha lo acompaña
  const setFrom = (from: string) => apply({ ...values, from, to: from && values.to && from > values.to ? from : values.to });
  const setTo = (to: string) => apply({ ...values, to, from: to && values.from && to < values.from ? to : values.from });

  return (
    <div role="search" aria-busy={pending} className="flex flex-wrap items-end gap-3">
      <FilterField id="from" label="Desde">
        <input id="from" type="date" value={values.from} max={today} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
      </FilterField>
      <FilterField id="to" label="Hasta">
        <input id="to" type="date" value={values.to} max={today} onChange={(e) => setTo(e.target.value)} className={inputClass} />
      </FilterField>
      <FilterField id="method" label="Forma de pago">
        <select id="method" value={values.method} onChange={(e) => apply({ ...values, method: e.target.value })} className={inputClass}>
          <option value="">Todas</option>
          {methods.map((m) => (
            <option key={m.id} value={m.name}>{m.name}</option>
          ))}
        </select>
      </FilterField>
      <FilterField id="status" label="Estado">
        <select
          id="status"
          value={values.status}
          onChange={(e) => apply({ ...values, status: e.target.value as Values["status"] })}
          className={inputClass}
        >
          <option value="">Todas</option>
          <option value="pagada">Pagadas</option>
          <option value="anulada">Anuladas</option>
        </select>
      </FilterField>
      {showReset && (
        <Link href="/admin/ventas" className={buttonClass("ghost")}>Ver hoy</Link>
      )}
      <p role="status" className="pb-2.5 text-sm text-muted">{pending ? "Actualizando…" : ""}</p>
    </div>
  );
}
