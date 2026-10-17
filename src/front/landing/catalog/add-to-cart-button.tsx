"use client";

import Link from "next/link";
import { ArrowRight, ShoppingCartSimple } from "@phosphor-icons/react";
import type { PublicProduct } from "@/shared/types";
import { useCart } from "../cart/cart-provider";

const round =
  "grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-primary text-white transition-colors hover:bg-primary-hover";

/**
 * Botón redondo de la tarjeta. Si el producto tiene una sola variante la agrega directo;
 * si tiene varias (colores, tamaños) lleva a la página del producto para elegir.
 */
export function AddToCartButton({ product }: { product: PublicProduct }) {
  const { add } = useCart();

  if (!product.in_stock) return null;

  if (product.variant_count > 1) {
    return (
      <Link href={`/producto/${product.slug}`} className={round} aria-label={`Elegir opciones de ${product.name}`} title="Elegir opciones">
        <ArrowRight size={20} weight="bold" aria-hidden />
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={round}
      aria-label={`Agregar ${product.name} al carrito`}
      title="Agregar al carrito"
      onClick={() =>
        add({
          variantId: product.variant_id,
          productId: product.id,
          slug: product.slug,
          name: product.name,
          variantLabel: "",
          price: product.price,
          image: product.images[0] ?? null,
        })
      }
    >
      <ShoppingCartSimple size={20} weight="bold" aria-hidden />
    </button>
  );
}
