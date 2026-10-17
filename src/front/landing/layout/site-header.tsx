"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { List, MagnifyingGlass, ShoppingCartSimple, Storefront, X } from "@phosphor-icons/react";
import { useCart } from "../cart/cart-provider";
import { Logo } from "./logo";

export type NavLink = { href: string; label: string; mobileOnly?: boolean };

export function SiteHeader({ storeName, links }: { storeName: string; links: NavLink[] }) {
  const pathname = usePathname();
  const cart = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuId = useId();
  const searchId = useId();

  // Al navegar se cierran el menú y el buscador (ajuste en el render, no en un efecto)
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
    setSearchOpen(false);
  }

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const iconBtn =
    "relative grid size-11 cursor-pointer place-items-center rounded-full text-foreground transition-colors hover:bg-primary-soft";

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6">
      <div className="mx-auto max-w-[82rem] rounded-[2rem] bg-surface/95 px-4 py-3 shadow-[0_6px_24px_rgb(29_42_32/0.06)] backdrop-blur sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <Logo name={storeName} />

          <nav aria-label="Principal" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {links.filter((l) => !l.mobileOnly).map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={pathname === l.href ? "page" : undefined}
                    className="rounded-full px-3 py-2 text-[0.95rem] font-bold text-foreground transition-colors hover:text-primary aria-[current=page]:text-primary xl:px-4"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className={iconBtn}
              aria-label="Buscar productos"
              aria-expanded={searchOpen}
              aria-controls={searchId}
              onClick={() => setSearchOpen((v) => !v)}
            >
              <MagnifyingGlass size={22} aria-hidden />
            </button>
            <button type="button" className={iconBtn} onClick={cart.open} aria-label={`Ver carrito, ${cart.count} productos`}>
              <ShoppingCartSimple size={22} aria-hidden />
              {cart.count > 0 && (
                <span className="absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[0.7rem] font-bold leading-5 text-white" aria-hidden>
                  {cart.count}
                </span>
              )}
            </button>
            {/* En el diseño este botón es "Mi cuenta"; acá no hay cuentas de cliente, lleva a la tienda */}
            <Link
              href="/tienda"
              className="ml-2 hidden items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-hover sm:inline-flex"
            >
              <Storefront size={18} weight="bold" aria-hidden /> Ver tienda
            </Link>
            <button
              type="button"
              className={`${iconBtn} lg:hidden`}
              aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X size={22} aria-hidden /> : <List size={22} aria-hidden />}
            </button>
          </div>
        </div>

        {searchOpen && (
          <form id={searchId} action="/tienda" method="get" role="search" className="flex gap-2 border-t border-border pb-1.5 pt-3">
            <label htmlFor={`${searchId}-q`} className="sr-only">Buscar productos</label>
            <input
              ref={searchRef}
              id={`${searchId}-q`}
              name="q"
              type="search"
              placeholder="Buscar mates, termos, yerbas…"
              className="min-w-0 flex-1 rounded-full border border-border-strong bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button type="submit" className="rounded-full bg-primary px-5 text-sm font-bold text-white hover:bg-primary-hover">
              Buscar
            </button>
          </form>
        )}

        {menuOpen && (
          <nav id={menuId} aria-label="Principal" className="border-t border-border pb-2 pt-2 lg:hidden">
            <ul className="grid gap-1">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="block rounded-2xl px-4 py-3 font-bold hover:bg-primary-soft hover:text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </header>
  );
}
