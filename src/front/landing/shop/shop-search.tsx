"use client";

import { useEffect, useRef, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import type { ShopFilters } from "@/shared/types";
import { useShopNavigation } from "./use-shop-navigation";

const DEBOUNCE_MS = 300;

/**
 * Búsqueda por texto de /tienda: actualiza la URL con una espera corta entre teclas, sin botón.
 * Quien la usa le pone key={filters.q} para que arranque de nuevo si la búsqueda cambia desde afuera.
 */
export function ShopSearch({ filters }: { filters: ShopFilters }) {
  const { apply } = useShopNavigation(filters);
  const [q, setQ] = useState(filters.q);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        clearTimeout(timer.current);
        apply({ q: q.trim() });
      }}
      className="relative"
    >
      <MagnifyingGlass size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
      <label htmlFor="shop-q" className="sr-only">Buscar productos</label>
      <input
        id="shop-q"
        type="search"
        value={q}
        onChange={(e) => {
          const value = e.target.value;
          setQ(value);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => apply({ q: value.trim() }), DEBOUNCE_MS);
        }}
        placeholder="Buscar productos"
        className="w-full rounded-full border border-border-strong bg-surface py-2.5 pl-11 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </form>
  );
}
