"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { shopQuery } from "@/shared/shop-filters";
import type { ShopFilters } from "@/shared/types";

/**
 * Cambia los filtros de la tienda reemplazando la URL (sin botón "Aplicar" y sin mover el scroll).
 * Cambiar un filtro vuelve a la página 1.
 */
export function useShopNavigation(filters: ShopFilters) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const go = (query: string) => startTransition(() => router.replace(`${pathname}${query}`, { scroll: false }));

  return {
    pending,
    apply: (patch: Partial<ShopFilters>) => go(shopQuery(filters, patch)),
    /** Saca todos los filtros, incluida la promo y la búsqueda. */
    clearAll: () => go(""),
  };
}
