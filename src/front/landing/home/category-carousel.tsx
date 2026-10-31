"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { PublicCategory } from "@/shared/types";
import { CategoryImage } from "../catalog/category-art";

/**
 * Carrusel de categorías del diseño: 4 tarjetas por vista en escritorio, deslizable en celular,
 * con flechas a los costados (solo aparecen si hay más para ver). Usa scroll nativo (touch, rueda y teclado).
 */
export function CategoryCarousel({ categories }: { categories: PublicCategory[] }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 1);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = trackRef.current;
    el?.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };

  const arrow =
    "absolute top-1/2 z-10 grid size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-2 border-white/80 bg-primary-deep text-white shadow-lg transition-transform hover:scale-110 hover:bg-foreground";

  return (
    <div className="relative">
      {canPrev && (
        <button type="button" onClick={() => scrollByPage(-1)} aria-label="Ver categorías anteriores" className={`${arrow} -left-4`}>
          <CaretLeft size={20} weight="bold" aria-hidden />
        </button>
      )}
      <ul
        ref={trackRef}
        onScroll={measure}
        className="scrollbar-none -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-1"
        aria-label="Categorías"
      >
        {categories.map((c, i) => (
          <li key={c.id} style={{ "--i": i } as React.CSSProperties} className="fx-float shrink-0 basis-[44%] snap-start sm:basis-[calc((100%-2rem)/3)] md:basis-[calc((100%-3rem)/4)] lg:basis-[calc((100%-4rem)/5)]">
            <Link
              href={`/tienda?categoria=${c.slug}`}
              className="relative flex h-full flex-col items-center rounded-3xl bg-surface p-3 pb-4 text-center transition-transform hover:-translate-y-1"
            >
              <CategoryImage src={c.image} slug={c.slug} sizes="(min-width: 1024px) 220px, 44vw" className="aspect-square w-full rounded-2xl" />
              <span className="mt-3 font-display text-lg font-bold leading-tight">{c.name}</span>
            </Link>
          </li>
        ))}
      </ul>

      {canNext && (
        <button type="button" onClick={() => scrollByPage(1)} aria-label="Ver más categorías" className={`${arrow} -right-4`}>
          <CaretRight size={20} weight="bold" aria-hidden />
        </button>
      )}
    </div>
  );
}
