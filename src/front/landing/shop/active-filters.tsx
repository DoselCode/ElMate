"use client";

import { X } from "@phosphor-icons/react";
import { formatMoney } from "@/shared/format";
import type { ShopFacets, ShopFilters } from "@/shared/types";
import { useShopNavigation } from "./use-shop-navigation";

type Chip = { id: string; label: string; patch: Partial<ShopFilters> };

function chipsFor(f: ShopFilters, facets: ShopFacets, promoName: string | null): Chip[] {
  const chips: Chip[] = [];
  if (f.q) chips.push({ id: "q", label: `“${f.q}”`, patch: { q: "" } });
  if (f.promo) chips.push({ id: "promo", label: promoName ?? "Promoción", patch: { promo: "" } });
  if (f.category) {
    const name = facets.categories.find((c) => c.slug === f.category)?.name ?? f.category;
    chips.push({ id: "cat", label: name, patch: { category: "" } });
  }
  for (const key of f.brands) {
    const name = facets.brands.find((b) => b.key === key)?.value ?? key;
    chips.push({ id: `brand-${key}`, label: name, patch: { brands: f.brands.filter((b) => b !== key) } });
  }
  for (const [optionKey, values] of Object.entries(f.options)) {
    const option = facets.options.find((o) => o.key === optionKey);
    for (const key of values) {
      const value = option?.values.find((v) => v.key === key)?.value ?? key;
      chips.push({
        id: `opt-${optionKey}-${key}`,
        label: `${option?.name ?? optionKey}: ${value}`,
        patch: { options: { ...f.options, [optionKey]: values.filter((v) => v !== key) } },
      });
    }
  }
  const { min, max } = f.price;
  if (min !== null || max !== null) {
    const label = min !== null && max !== null ? `${formatMoney(min)} – ${formatMoney(max)}` : min !== null ? `Desde ${formatMoney(min)}` : `Hasta ${formatMoney(max)}`;
    chips.push({ id: "price", label, patch: { price: { min: null, max: null } } });
  }
  if (f.offers) chips.push({ id: "offers", label: "Solo ofertas", patch: { offers: false } });
  if (f.inStock) chips.push({ id: "stock", label: "En stock", patch: { inStock: false } });
  return chips;
}

/** Lo que está filtrado, para sacar de a un filtro o todos juntos. */
export function ActiveFilters({ filters, facets, promoName }: { filters: ShopFilters; facets: ShopFacets; promoName: string | null }) {
  const { apply, clearAll } = useShopNavigation(filters);
  const chips = chipsFor(filters, facets, promoName);
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ul className="contents">
        {chips.map((chip) => (
          <li key={chip.id}>
            <button
              type="button"
              onClick={() => apply(chip.patch)}
              aria-label={`Quitar filtro ${chip.label}`}
              className="flex cursor-pointer items-center gap-1.5 rounded-full bg-primary-soft py-1.5 pl-3.5 pr-2.5 text-sm font-semibold text-primary hover:bg-primary hover:text-white"
            >
              {chip.label}
              <X size={14} weight="bold" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={clearAll} className="cursor-pointer px-2 text-sm font-semibold text-muted underline underline-offset-2 hover:text-primary">
        Limpiar todo
      </button>
    </div>
  );
}
