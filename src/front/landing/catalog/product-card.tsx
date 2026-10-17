import Link from "next/link";
import type { PublicProduct } from "@/shared/types";
import { AddToCartButton } from "./add-to-cart-button";
import { DiscountBadge, Price } from "./price";
import { ProductImage } from "./product-image";

export function ProductCard({
  product,
  className = "",
  style,
}: {
  product: PublicProduct;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <article style={style} className={`${className} group flex w-full flex-col rounded-[var(--radius-card)] bg-surface p-3 shadow-sm transition-shadow hover:shadow-md`}>
      <Link href={`/producto/${product.slug}`} className="relative block" tabIndex={-1} aria-hidden>
        <ProductImage
          src={product.images[0]}
          alt=""
          sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 90vw"
          className="aspect-[4/3] rounded-2xl"
        />
        <span className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <DiscountBadge pct={product.discount_pct} />
          {product.badge && (
            <span className="rounded-full bg-surface/95 px-2.5 py-1 text-xs font-bold text-primary">{product.badge}</span>
          )}
        </span>
        {!product.in_stock && (
          <span className="absolute inset-x-3 bottom-3 rounded-full bg-foreground/80 py-1 text-center text-xs font-bold text-white">
            Sin stock
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col px-2 pb-1 pt-3">
        {product.category_name && (
          <p className="text-xs font-bold uppercase tracking-wider text-primary">{product.category_name}</p>
        )}
        <h3 className="mt-1 font-display text-base font-bold leading-snug">
          <Link href={`/producto/${product.slug}`} className="hover:text-primary">
            {product.name}
          </Link>
        </h3>
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <Price price={product.price} compareAt={product.compare_at_price} from={product.has_price_range} perKg={product.unit === "kg"} />
          <AddToCartButton product={product} />
        </div>
      </div>
    </article>
  );
}

/** `reveal`: las tarjetas aparecen al scrollear, escalonadas por columna (animación en globals.css). */
export function ProductGrid({
  products,
  columns = 4,
  reveal = false,
}: {
  products: PublicProduct[];
  columns?: 3 | 4;
  reveal?: boolean;
}) {
  return (
    <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 ${columns === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
      {products.map((p, i) => (
        <ProductCard
          key={p.id}
          product={p}
          className={reveal ? "fx-vapor" : ""}
          style={reveal ? ({ "--i": i % columns } as React.CSSProperties) : undefined}
        />
      ))}
    </div>
  );
}
