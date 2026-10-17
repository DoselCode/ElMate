"use client";

import { useState } from "react";
import { ProductImage } from "../catalog/product-image";

/** Foto grande + miniaturas para cambiarla. Sin fotos, muestra el fondo de marca. */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? null;

  return (
    <div>
      <ProductImage
        src={current}
        alt={current ? `${name}, foto ${index + 1} de ${images.length}` : ""}
        sizes="(min-width: 1024px) 560px, 92vw"
        priority
        className="aspect-square rounded-[2rem] bg-surface"
      />
      {images.length > 1 && (
        <ul className="mt-4 flex gap-3">
          {images.map((src, i) => (
            <li key={src}>
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
