"use client";

import { useState } from "react";
import { CheckCircle, ShoppingCartSimple, XCircle } from "@phosphor-icons/react";
import type { PublicProduct, PublicVariant } from "@/shared/types";
import { QuantityStepper } from "../cart/cart-drawer";
import { useCart } from "../cart/cart-provider";
import { DiscountBadge, Price } from "../catalog/price";

/**
 * Elección de variante (una fila de botones por opción: Color, Tamaño…), cantidad y "Agregar al carrito".
 * Un valor se ve tachado si con lo ya elegido no existe esa combinación.
 */
export function VariantPicker({ product, variants }: { product: PublicProduct; variants: PublicVariant[] }) {
  const { add } = useCart();
  const options = product.option_names;
  const initial = variants.find((v) => v.in_stock) ?? variants[0];
  const [selected, setSelected] = useState<Record<string, string>>(initial?.attributes ?? {});
  const [quantity, setQuantity] = useState(1);

  const matches = (v: PublicVariant, sel: Record<string, string>) => options.every((o) => v.attributes[o] === sel[o]);
  const variant = variants.find((v) => matches(v, selected)) ?? null;

  if (!initial) {
    return <p className="mt-6 rounded-xl bg-warning-soft p-4 text-sm text-warning">Este producto no está disponible por ahora.</p>;
  }

  const valuesOf = (option: string) => [...new Set(variants.map((v) => v.attributes[option]).filter(Boolean))];
  const exists = (option: string, value: string) => variants.some((v) => matches(v, { ...selected, [option]: value }));

  function choose(option: string, value: string) {
    const next = { ...selected, [option]: value };
    // Si la combinación no existe, salta a la primera variante con ese valor
    if (!variants.some((v) => matches(v, next))) {
      const fallback = variants.find((v) => v.attributes[option] === value);
      if (fallback) return setSelected(fallback.attributes);
    }
    setSelected(next);
  }

  const shown = variant ?? initial;

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center gap-3">
        <Price price={shown.price} compareAt={shown.compare_at_price} size="lg" />
        {shown.compare_at_price && <DiscountBadge pct={Math.round(100 * (1 - shown.price / shown.compare_at_price))} />}
      </div>

      {options.map((option) => (
        <fieldset key={option}>
          <legend className="mb-2 text-sm font-bold">
            {option}: <span className="font-semibold text-muted">{selected[option]}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {valuesOf(option).map((value) => {
              const active = selected[option] === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => choose(option, value)}
                  aria-pressed={active}
                  className={`cursor-pointer rounded-full border-2 px-4 py-2 text-sm font-bold transition-colors ${
                    active
                      ? "border-primary bg-primary text-white"
                      : "border-border-strong bg-surface hover:border-primary hover:text-primary"
                  } ${exists(option, value) ? "" : "line-through opacity-60"}`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      {variant?.in_stock ? (
        <p className="flex items-center gap-2 text-sm font-bold text-success">
          <CheckCircle size={18} weight="fill" aria-hidden /> Hay stock
        </p>
      ) : (
        <p className="flex items-center gap-2 text-sm font-bold text-danger">
          <XCircle size={18} weight="fill" aria-hidden /> {variant ? "Sin stock en esta opción" : "Esa combinación no está disponible"}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper value={quantity} onChange={(q) => setQuantity(Math.max(1, q))} label={product.name} />
        <button
          type="button"
          disabled={!variant?.in_stock}
          onClick={() =>
            variant &&
            add(
              {
                variantId: variant.id,
                productId: product.id,
                slug: product.slug,
                name: product.name,
                variantLabel: variant.label,
                price: variant.price,
                image: variant.image ?? product.images[0] ?? null,
              },
              quantity,
            )
          }
          className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
        >
          <ShoppingCartSimple size={20} weight="bold" aria-hidden /> Agregar al carrito
        </button>
      </div>
    </div>
  );
}
