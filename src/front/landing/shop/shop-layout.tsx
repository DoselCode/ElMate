"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Faders, X } from "@phosphor-icons/react";
import { activeFilterCount } from "@/shared/shop-filters";
import type { ShopFacets, ShopFilters, ShopSort } from "@/shared/types";
import { hasFacets, ShopSidebar } from "./shop-sidebar";
import { useShopNavigation } from "./use-shop-navigation";

const SORT_LABELS: Record<ShopSort, string> = {
  destacados: "Destacados",
  "precio-asc": "Menor precio",
  "precio-desc": "Mayor precio",
  nuevos: "Más nuevos",
};

const HIDDEN_KEY = "shop.filtersHidden";

// "Ocultar filtros" se recuerda en el navegador; si no hay almacenamiento, vale para esta visita
let memoryHidden = false;
const hiddenListeners = new Set<() => void>();
const subscribeHidden = (cb: () => void) => {
  hiddenListeners.add(cb);
  return () => hiddenListeners.delete(cb);
};
function readHidden(): boolean {
  try {
    const stored = localStorage.getItem(HIDDEN_KEY);
    return stored === null ? memoryHidden : stored === "1";
  } catch {
    return memoryHidden;
  }
}
function writeHidden(value: boolean) {
  memoryHidden = value;
  try {
    localStorage.setItem(HIDDEN_KEY, value ? "1" : "0");
  } catch {
    // queda solo en memoria
  }
  hiddenListeners.forEach((cb) => cb());
}

/**
 * Encabezado de la tienda (título, ocultar filtros, orden) y el layout de dos columnas.
 * En el celular los filtros se abren en un panel lateral.
 */
export function ShopLayout({
  title,
  total,
  filters,
  facets,
  children,
}: {
  title: string;
  total: number;
  filters: ShopFilters;
  facets: ShopFacets;
  children: ReactNode;
}) {
  const { apply } = useShopNavigation(filters);
  // El servidor siempre los muestra; en el navegador se lee la preferencia guardada
  const hidden = useSyncExternalStore(subscribeHidden, readHidden, () => false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const count = activeFilterCount(filters);
  const showSidebar = hasFacets(facets) || count > 0;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (drawerOpen && !el.open) el.showModal();
    if (!drawerOpen && el.open) el.close();
  }, [drawerOpen]);

  const toggleHidden = () => writeHidden(!hidden);

  const closeDrawer = () => {
    setDrawerOpen(false);
    opener.current?.focus();
  };

  return (
    <>
      <header className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          {title} <span className="text-muted">({total})</span>
        </h1>
        <div className="flex items-center gap-2 sm:gap-4">
          {showSidebar && (
            <>
              <button
                type="button"
                onClick={toggleHidden}
                aria-controls="shop-sidebar"
                aria-expanded={!hidden}
                className="hidden cursor-pointer items-center gap-2 rounded-full px-3 py-2 text-sm font-bold hover:bg-primary-soft hover:text-primary lg:flex"
              >
                {hidden ? "Mostrar filtros" : "Ocultar filtros"}
                <Faders size={18} aria-hidden />
              </button>
              <button
                ref={opener}
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-haspopup="dialog"
                className="flex cursor-pointer items-center gap-2 rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-bold lg:hidden"
              >
                <Faders size={18} aria-hidden />
                Filtros{count > 0 && ` (${count})`}
              </button>
            </>
          )}
          <label htmlFor="shop-sort" className="text-sm font-bold">
            <span className="hidden sm:inline">Ordenar por</span>
            <span className="sr-only sm:hidden">Ordenar por</span>
          </label>
          <select
            id="shop-sort"
            value={filters.sort}
            onChange={(e) => apply({ sort: e.target.value as ShopSort })}
            className="cursor-pointer rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold focus:border-primary focus:outline-none"
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </header>

      <div className={`mt-6 ${showSidebar && !hidden ? "lg:grid lg:grid-cols-[16rem_1fr] lg:gap-10" : ""}`}>
        {showSidebar && !hidden && (
          <aside id="shop-sidebar" className="hidden lg:block">
            {/* pl/-ml: el scroll recorta en el borde; sin ese margen los checks y su contorno de foco quedan cortados */}
            <div className="sticky top-24 -ml-1.5 max-h-[calc(100dvh-7rem)] overflow-y-auto pl-1.5 pr-2">
              <ShopSidebar filters={filters} facets={facets} />
            </div>
          </aside>
        )}
        <div className="min-w-0">{children}</div>
      </div>

      {showSidebar && (
        <dialog
          ref={dialog}
          aria-labelledby="filters-title"
          onClose={() => setDrawerOpen(false)}
          onClick={(e) => {
            if (e.target === dialog.current) closeDrawer(); // clic en el fondo
          }}
          className="filters-drawer m-0 mr-auto h-dvh max-h-dvh w-full max-w-sm overflow-hidden bg-background p-0 text-foreground shadow-2xl lg:hidden"
        >
          <div className="flex h-full flex-col">
            <header className="flex items-center justify-between border-b border-border bg-surface px-5 py-4">
              <h2 id="filters-title" className="font-display text-xl font-bold">Filtros</h2>
              <button type="button" onClick={closeDrawer} aria-label="Cerrar los filtros"
                className="grid size-10 cursor-pointer place-items-center rounded-full hover:bg-primary-soft">
                <X size={20} aria-hidden />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-5">
              <ShopSidebar filters={filters} facets={facets} />
            </div>
            <footer className="border-t border-border bg-surface p-4">
              <button type="button" onClick={closeDrawer}
                className="w-full cursor-pointer rounded-full bg-primary py-3 text-sm font-bold text-white hover:bg-primary-hover">
                Ver {total} {total === 1 ? "producto" : "productos"}
              </button>
            </footer>
          </div>
        </dialog>
      )}
    </>
  );
}
