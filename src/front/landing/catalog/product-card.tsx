import Link from "next/link";
import type { PublicProduct } from "@/shared/types";
import { AddToCartButton } from "./add-to-cart-button";
import { DiscountBadge, Price } from "./price";
import { CategoryImage } from "./category-art";

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
    <article style={style} className={`${className} group flex w-full flex-col rounded-[var(--radius-card)] bg-surface p-2 shadow-sm sm:p-3 transition-shadow hover:shadow-md`}>
      <Link href={`/producto/${product.slug}`} className="relative block" tabIndex={-1} aria-hidden>
        <CategoryImage
          src={product.images[0]}
          slug={product.category_slug ?? product.name}
          sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 90vw"
          className="aspect-square rounded-xl sm:aspect-[4/3] sm:rounded-2xl"
        />
        <span className="absolute left-2 top-2 flex flex-wrap gap-1 sm:left-3 sm:top-3 sm:gap-1.5">
          <DiscountBadge pct={product.discount_pct} />
          {product.badge && (
            <span className="rounded-full bg-surface/95 px-2.5 py-1 text-xs font-bold text-primary">{product.badge}</span>
          )}
        </span>
        {!product.in_stock && (
          <span className="absolute inset-x-2 bottom-2 rounded-full bg-foreground/80 py-0.5 text-center text-[0.65rem] sm:inset-x-3 sm:bottom-3 sm:py-1 sm:text-xs font-bold text-white">
            Sin stock
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col px-1 pb-0.5 pt-2 sm:px-2 sm:pb-1 sm:pt-3">
        {product.category_name && (
          <p className="truncate text-[0.6rem] font-bold uppercase tracking-wider text-primary sm:text-xs">{product.category_name}</p>
        )}
        <h3 className="mt-0.5 line-clamp-2 font-display text-sm font-bold leading-snug sm:mt-1 sm:text-base">
          <Link href={`/producto/${product.slug}`} className="hover:text-primary">
            {product.name}
          </Link>
        </h3>
        <div className="mt-auto flex items-end justify-between gap-1.5 pt-2 sm:gap-2 sm:pt-3">
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
    <div className={`grid grid-cols-2 gap-3 sm:gap-5 ${columns === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
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
