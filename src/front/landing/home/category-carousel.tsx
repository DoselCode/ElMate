"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicCategory } from "@/shared/types";
import { ProductImage } from "../catalog/product-image";

/**
 * Carrusel de categorías del diseño: 4 tarjetas por vista en escritorio, deslizable en celular,
 * con puntitos para cambiar de página. Usa scroll nativo (funciona con touch, rueda y teclado).
 */
export function CategoryCarousel({ categories }: { categories: PublicCategory[] }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    // La última página puede estar incompleta (5 tarjetas de a 4 = 2 páginas): se redondea hacia arriba
    const total = Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth - 0.01));
    setPages(total);
    setPage(Math.min(total - 1, Math.ceil(el.scrollLeft / el.clientWidth - 0.01)));
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: Math.min(i * el.clientWidth, el.scrollWidth - el.clientWidth), behavior: "smooth" });
  };

  return (
    <div>
      <ul
        ref={trackRef}
        onScroll={measure}
        className="scrollbar-none -mx-1 flex snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-1"
        aria-label="Categorías"
      >
        {categories.map((c, i) => (
          <li key={c.id} style={{ "--i": i } as React.CSSProperties} className="fx-float shrink-0 basis-[72%] snap-start sm:basis-[calc((100%-2.5rem)/3)] lg:basis-[calc((100%-3.75rem)/4)]">
            <Link
              href={`/tienda?categoria=${c.slug}`}
              className="flex h-full flex-col items-center rounded-3xl bg-surface px-5 pb-6 pt-5 text-center transition-transform hover:-translate-y-1"
            >
              <ProductImage src={c.image} alt="" sizes="180px" className="aspect-square w-full max-w-40 rounded-2xl" />
              <span className="mt-5 font-display text-lg font-bold">{c.name}</span>
              <span className="mt-0.5 text-sm text-muted">
                {c.product_count} {c.product_count === 1 ? "producto" : "productos"}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Ver categorías, página ${i + 1} de ${pages}`}
              aria-current={i === page}
              className={`h-2 cursor-pointer rounded-full transition-all ${i === page ? "w-6 bg-white" : "w-2 bg-white/40 hover:bg-white/70"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
