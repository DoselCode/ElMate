"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { ArrowsLeftRight, CashRegister, ChartLineUp, List, Package, Receipt, ShoppingCart, SignOut, Storefront, Tag, X } from "@phosphor-icons/react";
import { signOutAction } from "@/back/admin/auth/actions";
import { BrandLetters } from "@/front/landing/layout/brand-letters";
import { clearPosDraft } from "@/front/admin/sales/pos-draft";
import { saveSalesQuery, useSalesQuery } from "@/front/admin/sales/sales-last-query";
import { STAGE_2 } from "@/shared/features";
import type { Role } from "@/shared/types";

/** Secciones del panel. Para agregar una pantalla nueva, sumarla acá. */
// stage2: secciones de la entrega final (ver shared/features.ts); se pueden ocultar con NEXT_PUBLIC_ELMATE_ETAPA2=0.
const ALL_ITEMS = [
  { href: "/admin/ventas/nueva", label: "Nueva venta", icon: ShoppingCart, adminOnly: false, stage2: true },
  { href: "/admin/caja", label: "Caja", icon: CashRegister, adminOnly: false, stage2: true },
  // El empleado solo ve Nueva venta y Caja (shared/roles.ts)
  { href: "/admin/ventas", label: "Ventas", icon: Receipt, adminOnly: true, stage2: true },
  { href: "/admin/stock", label: "Inventario y stock", icon: Package, adminOnly: true, stage2: false },
  { href: "/admin/stock/movements", label: "Movimientos", icon: ArrowsLeftRight, adminOnly: true, stage2: false },
  { href: "/admin/promociones", label: "Promociones", icon: Tag, adminOnly: true, stage2: false },
  { href: "/admin/ingresos", label: "Ingresos", icon: ChartLineUp, adminOnly: true, stage2: true },
  { href: "/admin/local", label: "Datos del local", icon: Storefront, adminOnly: true, stage2: false },
] as const;

// ---- Menú plegado o desplegado: se recuerda en el navegador ---------------------------------
const STORAGE_KEY = "elmate-admin-menu";
const listeners = new Set<() => void>();

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "collapsed";
  } catch {
    return false; // almacenamiento bloqueado: el menú funciona igual, sin recordar
  }
}

function writeCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "collapsed" : "open");
  } catch {
    // idem
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function Sidebar({ userName, role, logo }: { userName: string; role: Role; logo: string | null }) {
  const pathname = usePathname();
  // En el servidor y en la primera pintada el menú está desplegado; después se lee lo guardado
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  // "Ventas" vuelve a la lista con los últimos filtros usados en esta pestaña
  const salesQuery = useSalesQuery();
  const items = ALL_ITEMS.filter((i) => (!i.adminOnly || role === "admin") && (!i.stage2 || STAGE_2));

  // /admin/stock es prefijo de /admin/stock/movements (y /admin/ventas de /nueva): el activo es el más específico
  const active = [...items].sort((a, b) => b.href.length - a.href.length).find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));

  return (
    <aside
      className={`relative flex flex-col gap-4 rounded-3xl bg-primary p-4 text-white transition-[width] duration-200 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:shrink-0 lg:gap-0 lg:rounded-[var(--radius-card)] lg:py-8 ${
        collapsed ? "lg:w-[4.75rem] lg:px-2" : "lg:w-72 lg:px-4"
      }`}
    >
      <button
        type="button"
        onClick={() => writeCollapsed(!collapsed)}
        aria-label={collapsed ? "Desplegar el menú" : "Plegar el menú"}
        aria-expanded={!collapsed}
        aria-controls="admin-menu"
        title={collapsed ? "Desplegar el menú" : "Plegar el menú"}
        className={`absolute grid size-9 cursor-pointer place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 ${
          collapsed ? "right-4 top-3.5 lg:left-1/2 lg:right-auto lg:top-3 lg:-translate-x-1/2" : "right-3 top-3"
        }`}
      >
        {collapsed ? <List size={20} weight="bold" aria-hidden /> : <X size={18} weight="bold" aria-hidden />}
      </button>

      <div className={`flex items-center gap-3 ${collapsed ? "lg:mb-6 lg:mt-12 lg:justify-center" : "lg:mb-10 lg:flex-col lg:text-center"}`}>
        {/* Logo de ElMate (letras apiladas) sobre una base blanca para que se lea en el menú azul */}
        <div
          role="img"
          aria-label="ElMate"
          className={`grid shrink-0 place-items-center rounded-2xl bg-white shadow-sm ${
            collapsed ? "size-11 p-1.5" : "size-12 p-2 lg:size-24 lg:p-3.5"
          }`}
        >
          {logo ? (
            <span className="relative block size-full">
              <Image src={logo} alt="" fill sizes="96px" className="object-contain" />
            </span>
          ) : (
            <BrandLetters fill="#1c1c1c" className="h-full w-auto" />
          )}
        </div>
        <div className={`font-display text-lg leading-tight tracking-wide ${collapsed ? "lg:hidden" : ""}`}>
          El Mate
          <span className="block font-sans text-[0.65rem] uppercase tracking-[0.25em] text-white/75">Administración</span>
        </div>
      </div>

      {/* Plegado en pantallas chicas: solo queda la barra del logo y el botón */}
      <nav
        id="admin-menu"
        aria-label="Principal"
        className={`flex-wrap gap-1 lg:flex lg:flex-1 lg:flex-col lg:flex-nowrap ${collapsed ? "hidden" : "flex"}`}
      >
        {items.map(({ href, label, icon: Icon }) => {
          const isActive = active?.href === href;
          return (
            <Link
              key={href}
              href={href === "/admin/ventas" ? `${href}${salesQuery}` : href}
              aria-current={isActive ? "page" : undefined}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-2.5 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition-colors lg:gap-3 lg:py-3 ${
                collapsed ? "lg:justify-center lg:px-0" : "lg:px-5"
              } ${isActive ? "bg-white text-primary shadow-sm" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
            >
              <Icon size={20} weight={isActive ? "fill" : "regular"} aria-hidden />
              <span className={collapsed ? "lg:sr-only" : ""}>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div
        className={`mt-auto items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3 lg:mt-4 ${
          collapsed ? "hidden lg:flex lg:flex-col lg:px-1" : "flex"
        }`}
      >
        <div className={`min-w-0 ${collapsed ? "lg:sr-only" : ""}`}>
          <p className="truncate text-sm font-semibold">{userName}</p>
          <p className="text-xs capitalize text-white/75">{role}</p>
        </div>
        {/* Al salir se descartan la venta a medio cargar y los filtros recordados de esta pestaña */}
        <form
          action={signOutAction}
          onSubmit={() => {
            clearPosDraft();
            saveSalesQuery("");
          }}
        >
          <button
            type="submit"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="grid size-9 cursor-pointer place-items-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white"
          >
            <SignOut size={20} aria-hidden />
          </button>
        </form>
      </div>
    </aside>
  );
}
