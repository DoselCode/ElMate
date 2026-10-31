import { formatMoney } from "@/shared/format";

/** Precio con el anterior tachado si hay oferta. `from`: "Desde" cuando las variantes tienen distintos precios. */
export function Price({
  price,
  compareAt,
  from = false,
  size = "md",
  perKg = false,
}: {
  price: number;
  compareAt: number | null;
  from?: boolean;
  size?: "md" | "lg";
  /** Producto a granel: el precio es por kilo. */
  perKg?: boolean;
}) {
  return (
    <div className="leading-tight">
      {compareAt !== null && (
        <p className={`text-muted line-through ${size === "lg" ? "text-base" : "text-xs"}`}>
          <span className="sr-only">Antes </span>
          {formatMoney(compareAt)}
        </p>
      )}
      <p className={`font-display font-bold tabular-nums text-foreground ${size === "lg" ? "text-4xl" : "text-xl"}`}>
        {from && <span className={`mr-1 font-sans font-semibold text-muted ${size === "lg" ? "text-base" : "text-xs"}`}>Desde</span>}
        {compareAt !== null && <span className="sr-only">Ahora </span>}
        {formatMoney(price)}
        {perKg && <span className={`ml-0.5 font-sans font-semibold text-muted ${size === "lg" ? "text-base" : "text-xs"}`}>/kg</span>}
      </p>
    </div>
  );
}

export function DiscountBadge({ pct }: { pct: number | null }) {
  if (!pct || pct <= 0) return null;
  return (
    <span className="rounded-full bg-sale px-2.5 py-1 text-xs font-bold text-white">
      -{pct}%<span className="sr-only"> de descuento</span>
    </span>
  );
}
