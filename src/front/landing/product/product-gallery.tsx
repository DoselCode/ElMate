"use client";

import { useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { ProductImage } from "../catalog/product-image";

/** Foto grande con flechas + miniaturas para cambiarla. Sin fotos, muestra el fondo de marca. */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? null;
  const many = images.length > 1;
  const go = (dir: 1 | -1) => setIndex((i) => (i + dir + images.length) % images.length);

  const arrow =
    "absolute top-1/2 z-10 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-2 border-white/80 bg-primary-deep text-white shadow-lg transition-transform hover:scale-110 hover:bg-primary";

  return (
    <div>
      <div
        className="relative"
        onKeyDown={(e) => {
          if (!many) return;
          if (e.key === "ArrowLeft") go(-1);
          if (e.key === "ArrowRight") go(1);
        }}
      >
        <ProductImage
          src={current}
          alt={current ? `${name}, foto ${index + 1} de ${images.length}` : ""}
          sizes="(min-width: 1024px) 560px, 92vw"
          priority
          className="aspect-square rounded-[2rem] bg-surface"
        />
        {many && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Foto anterior" className={`${arrow} left-3`}>
              <CaretLeft size={22} weight="bold" aria-hidden />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Foto siguiente" className={`${arrow} right-3`}>
              <CaretRight size={22} weight="bold" aria-hidden />
            </button>
            <p className="absolute bottom-3 right-4 rounded-full bg-primary-deep/80 px-3 py-1 text-sm font-bold tabular-nums text-white" aria-hidden>
              {index + 1} / {images.length}
            </p>
          </>
        )}
      </div>
      {many && (
        <ul className="mt-4 flex gap-3 overflow-x-auto">
          {images.map((src, i) => (
            <li key={src} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ver foto ${i + 1}`}
                aria-current={i === index}
                className={`block cursor-pointer overflow-hidden rounded-2xl border-2 ${i === index ? "border-primary" : "border-transparent hover:border-border-strong"}`}
              >
                <ProductImage src={src} alt="" sizes="80px" className="size-20" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
