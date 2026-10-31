"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { PublicCategory } from "@/shared/types";

type Item = Pick<PublicCategory, "id" | "name"> & { href: string; active: boolean };

/** Chips de categorías con scroll horizontal y flechas a los costados (solo aparecen si hay más para ver). */
export function CategoryNav({ items }: { items: Item[] }) {
  const trackRef = useRef<HTMLElement>(null);
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
    measure();
    return () => observer.disconnect();
  }, [measure, items.length]);

  // La categoría activa queda a la vista al cargar (sin mover el scroll de la página)
  useEffect(() => {
    const el = trackRef.current;
    const active = el?.querySelector<HTMLElement>("[aria-current='page']");
    if (!el || !active) return;
    el.scrollLeft = Math.max(0, active.offsetLeft - el.clientWidth / 2 + active.offsetWidth / 2);
  }, []);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    el?.scrollBy({ left: dir * el.clientWidth * 0.75, behavior: "smooth" });
  };

  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-colors ${
      active ? "bg-primary text-white" : "bg-surface text-foreground hover:bg-primary-soft hover:text-primary"
    }`;
  const arrow =
    "absolute top-1/2 z-10 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-surface text-foreground shadow-md transition-colors hover:bg-primary hover:text-white";

  return (
    <div className="relative mt-6">
      {canPrev && (
        <button type="button" onClick={() => scrollBy(-1)} aria-label="Ver categorías anteriores" className={`${arrow} -left-3`}>
          <CaretLeft size={18} weight="bold" aria-hidden />
        </button>
      )}
      <nav ref={trackRef} onScroll={measure} aria-label="Categorías" className="scrollbar-none flex gap-2 overflow-x-auto">
        {items.map((c) => (
          <Link key={c.id} href={c.href} className={chip(c.active)} aria-current={c.active ? "page" : undefined}>
            {c.name}
          </Link>
        ))}
      </nav>
      {canNext && (
        <button type="button" onClick={() => scrollBy(1)} aria-label="Ver más categorías" className={`${arrow} -right-3`}>
          <CaretRight size={18} weight="bold" aria-hidden />
        </button>
      )}
    </div>
  );
}
