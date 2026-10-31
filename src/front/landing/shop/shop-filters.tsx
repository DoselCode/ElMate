"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { buildQuery } from "@/shared/query";
import type { ShopFilters, ShopSort } from "@/shared/types";

const SORT_LABELS: Record<ShopSort, string> = {
  destacados: "Destacados",
  "precio-asc": "Menor precio",
  "precio-desc": "Mayor precio",
  nuevos: "Más nuevos",
};

const DEBOUNCE_MS = 300;

/**
 * Filtros de /tienda: cada control actualiza la URL por su cuenta (el texto con una espera corta
 * entre teclas), sin botón "Aplicar". Cambiar un filtro vuelve a la página 1.
 */
export function ShopFiltersBar({ filters }: { filters: ShopFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q ?? "");
  const [sort, setSort] = useState<ShopSort>(filters.sort);
  const [offers, setOffers] = useState(filters.offers);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hasFilters = Boolean(q.trim() || filters.category || offers);

  useEffect(() => () => clearTimeout(timer.current), []);

  const navigate = (next: { q: string; sort: ShopSort; offers: boolean }) => {
    const query = buildQuery({
      q: next.q.trim(),
      categoria: filters.category,
      orden: next.sort === "destacados" ? undefined : next.sort,
      ofertas: next.offers ? "1" : undefined,
    });
    startTransition(() => router.replace(`${pathname}${query}`, { scroll: false }));
  };

  const onSearch = (value: string) => {
    setQ(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => navigate({ q: value, sort, offers }), DEBOUNCE_MS);
  };

  const clear = () => {
    clearTimeout(timer.current);
    setQ("");
    setSort("destacados");
    setOffers(false);
    startTransition(() => router.replace(pathname, { scroll: false }));
  };

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        clearTimeout(timer.current);
        navigate({ q, sort, offers });
      }}
      className="mt-5 flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] bg-surface p-3 shadow-sm"
    >
      <div className="relative min-w-52 flex-1">
        <MagnifyingGlass size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <label htmlFor="shop-q" className="sr-only">Buscar productos</label>
        <input
          id="shop-q"
          type="search"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Buscar productos"
          className="w-full rounded-full border border-border-strong bg-background py-2.5 pl-11 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <label htmlFor="shop-sort" className="sr-only">Ordenar por</label>
      <select
        id="shop-sort"
        value={sort}
        onChange={(e) => {
          const next = e.target.value as ShopSort;
          setSort(next);
          navigate({ q, sort: next, offers });
        }}
        className="rounded-full border border-border-strong bg-background px-4 py-2.5 text-sm font-semibold focus:border-primary focus:outline-none"
      >
        {Object.entries(SORT_LABELS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <label className="flex items-center gap-2 px-1 text-sm font-semibold">
        <input
          type="checkbox"
          checked={offers}
          onChange={(e) => {
            setOffers(e.target.checked);
            navigate({ q, sort, offers: e.target.checked });
          }}
          className="size-4 accent-primary"
        />
        Solo ofertas
      </label>
      {hasFilters && (
        <button type="button" onClick={clear} className="cursor-pointer px-2 text-sm font-semibold text-muted underline underline-offset-2 hover:text-primary">
          Limpiar
        </button>
      )}
    </form>
  );
}
