"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { shopQuery, toggleValue } from "@/shared/shop-filters";
import type { FacetValue, ShopFacets, ShopFilters } from "@/shared/types";
import { useShopNavigation } from "./use-shop-navigation";

/** Las opciones elegidas siguen a la vista aunque ya no tengan productos, para poder destildarlas. */
function withSelected(values: FacetValue[], selected: string[]): FacetValue[] {
  const missing = selected.filter((key) => !values.some((v) => v.key === key)).map((key) => ({ key, value: key, count: 0 }));
  return [...values, ...missing];
}

/** Hay algo para mostrar en la barra lateral. */
export function hasFacets(f: ShopFacets): boolean {
  return Boolean(f.categories.length || f.brands.length || f.options.length || f.price || f.offers || f.inStock);
}

function Section({ title, open, children }: { title: string; open: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group border-b border-border py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-bold [&::-webkit-details-marker]:hidden">
        {title}
        <CaretDown size={16} weight="bold" className="text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="mt-3 space-y-2.5">{children}</div>
    </details>
  );
}

function Check({ label, count, checked, onChange }: { label: string; count: number; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm hover:text-primary">
      <input type="checkbox" checked={checked} onChange={onChange} className="size-4 shrink-0 cursor-pointer accent-primary" />
      <span className="flex-1">
        {label} <span className="text-muted">({count})</span>
      </span>
    </label>
  );
}

function PriceFilter({ filters, facets }: { filters: ShopFilters; facets: ShopFacets }) {
  const { apply } = useShopNavigation(filters);
  const id = useId();
  const [min, setMin] = useState(filters.price.min?.toString() ?? "");
  const [max, setMax] = useState(filters.price.max?.toString() ?? "");
  const toNumber = (v: string) => (/^\d{1,9}$/.test(v.trim()) ? Number(v.trim()) : null);

  const submit = () => {
    const next = { min: toNumber(min), max: toNumber(max) };
    if (next.min !== filters.price.min || next.max !== filters.price.max) apply({ price: next });
  };
  const input = "w-full rounded-full border border-border-strong bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-center gap-2"
    >
      <label className="sr-only" htmlFor={`${id}-min`}>Precio mínimo</label>
      <input id={`${id}-min`} type="number" inputMode="numeric" min={0} value={min} onChange={(e) => setMin(e.target.value)} onBlur={submit}
        placeholder={facets.price ? `$ ${Math.floor(facets.price.min)}` : "Mínimo"} className={input} />
      <span className="text-muted" aria-hidden>–</span>
      <label className="sr-only" htmlFor={`${id}-max`}>Precio máximo</label>
      <input id={`${id}-max`} type="number" inputMode="numeric" min={0} value={max} onChange={(e) => setMax(e.target.value)} onBlur={submit}
        placeholder={facets.price ? `$ ${Math.ceil(facets.price.max)}` : "Máximo"} className={input} />
    </form>
  );
}

/** Filtros de la tienda en secciones plegables. Las opciones y sus cantidades salen de la base. */
export function ShopSidebar({ filters, facets }: { filters: ShopFilters; facets: ShopFacets }) {
  const { apply } = useShopNavigation(filters);
  const categories = facets.categories.some((c) => c.slug === filters.category) || !filters.category
    ? facets.categories
    : [...facets.categories, { slug: filters.category, name: filters.category, count: 0 }];
  const brands = withSelected(facets.brands, filters.brands);
  const selectedOptionKeys = Object.keys(filters.options).filter((k) => !facets.options.some((o) => o.key === k));
  const options = [
    ...facets.options,
    ...selectedOptionKeys.map((key) => ({ key, name: key, values: [] as FacetValue[] })),
  ];
  const hasPrice = filters.price.min !== null || filters.price.max !== null;

  return (
    <nav aria-label="Filtros" className="text-foreground">
      {categories.length > 0 && (
        <Section title="Categoría" open>
          <ul className="space-y-2">
            {filters.category && (
              <li>
                <Link href={`/tienda${shopQuery(filters, { category: "" })}`} scroll={false} className="text-sm font-semibold text-muted hover:text-primary">
                  ← Todas las categorías
                </Link>
              </li>
            )}
            {categories.map((c) => {
              const active = c.slug === filters.category;
              return (
                <li key={c.slug}>
                  <Link
                    href={`/tienda${shopQuery(filters, { category: active ? "" : c.slug })}`}
                    scroll={false}
                    aria-current={active ? "page" : undefined}
                    className={`text-sm hover:text-primary ${active ? "font-bold text-primary" : ""}`}
                  >
                    {c.name} <span className="text-muted">({c.count})</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {brands.length > 0 && (
        <Section title="Marca" open={filters.brands.length > 0}>
          {brands.map((b) => (
            <Check key={b.key} label={b.value} count={b.count} checked={filters.brands.includes(b.key)}
              onChange={() => apply({ brands: toggleValue(filters.brands, b.key) })} />
          ))}
        </Section>
      )}

      {(facets.price || hasPrice) && (
        <Section title="Precio" open={hasPrice}>
          {/* key: si el precio cambia desde afuera (chip, limpiar), los campos arrancan de nuevo */}
          <PriceFilter key={`${filters.price.min}-${filters.price.max}`} filters={filters} facets={facets} />
        </Section>
      )}

      {options.map((o) => {
        const selected = filters.options[o.key] ?? [];
        return (
          <Section key={o.key} title={o.name} open={selected.length > 0}>
            {withSelected(o.values, selected).map((v) => (
              <Check key={v.key} label={v.value} count={v.count} checked={selected.includes(v.key)}
                onChange={() => apply({ options: { ...filters.options, [o.key]: toggleValue(selected, v.key) } })} />
            ))}
          </Section>
        );
      })}

      {(facets.offers > 0 || facets.inStock > 0 || filters.offers || filters.inStock) && (
        <Section title="Disponibilidad" open={filters.offers || filters.inStock}>
          {(facets.offers > 0 || filters.offers) && (
            <Check label="Solo ofertas" count={facets.offers} checked={filters.offers} onChange={() => apply({ offers: !filters.offers })} />
          )}
          {(facets.inStock > 0 || filters.inStock) && (
            <Check label="En stock" count={facets.inStock} checked={filters.inStock} onChange={() => apply({ inStock: !filters.inStock })} />
          )}
        </Section>
      )}
    </nav>
  );
}
