"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowsLeftRight, Package, SignOut } from "@phosphor-icons/react";
import { signOutAction } from "@/app/admin/login/actions";

const items = [
  { href: "/admin/stock", label: "Inventario y stock", icon: Package, exact: true },
  { href: "/admin/stock/movements", label: "Movimientos", icon: ArrowsLeftRight, exact: false },
] as const;

export function Sidebar({ userName, role }: { userName: string; role: "admin" | "empleado" }) {
  const pathname = usePathname();

  // /admin/stock también es prefijo de /admin/stock/movements: el activo es el más específico
  const active = [...items].sort((a, b) => b.href.length - a.href.length).find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));

  return (
    <aside className="flex flex-col gap-4 rounded-3xl bg-primary p-4 text-white lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-72 lg:shrink-0 lg:gap-0 lg:rounded-[var(--radius-card)] lg:px-4 lg:py-8">
      <div className="flex items-center gap-3 lg:mb-10 lg:flex-col lg:text-center">
        <div className="grid size-11 place-items-center rounded-full bg-white/15 font-serif text-lg font-bold lg:size-20 lg:text-3xl">
          M
        </div>
        <div className="font-serif text-lg leading-tight tracking-wide">
          El Mate
          <span className="block font-sans text-[0.65rem] uppercase tracking-[0.25em] text-white/75">Administración</span>
        </div>
      </div>

      <nav aria-label="Principal" className="flex flex-wrap gap-1 lg:flex-1 lg:flex-col lg:flex-nowrap">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive = active?.href === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-2.5 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition-colors lg:gap-3 lg:px-5 lg:py-3 ${
                isActive ? "bg-white text-primary shadow-sm" : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={20} weight={isActive ? "fill" : "regular"} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3 lg:mt-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{userName}</p>
          <p className="text-xs capitalize text-white/75">{role}</p>
        </div>
        <form action={signOutAction}>
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
