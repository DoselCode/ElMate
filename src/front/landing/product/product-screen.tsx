import Link from "next/link";
import type { ProductPageData } from "@/shared/types";
import { ProductGrid } from "../catalog/product-card";
import { SectionHeading } from "../home/section-heading";
import { ProductGallery } from "./product-gallery";
import { VariantPicker } from "./variant-picker";

/** /producto/[slug]: fotos, opciones, precio, agregar al carrito y productos relacionados. */
export function ProductScreen({ data }: { data: ProductPageData }) {
  const { product, variants, related, paymentMethods } = data;

  return (
    <div className="mx-auto max-w-[85rem] px-4 pt-10 sm:px-6">
      <nav aria-label="Ubicación" className="text-sm text-muted">
        <Link href="/" className="hover:text-primary">Inicio</Link> <span aria-hidden>/</span>{" "}
        {product.category_slug && (
          <>
            <Link href={`/tienda?categoria=${product.category_slug}`} className="hover:text-primary">
              {product.category_name}
            </Link>{" "}
            <span aria-hidden>/</span>{" "}
          </>
        )}
        <span>{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-14">
        <ProductGallery images={product.images} name={product.name} />

        <div>
          {product.category_name && (
            <p className="text-sm font-extrabold uppercase tracking-wider text-primary">{product.category_name}</p>
          )}
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight sm:text-4xl">{product.name}</h1>
          {product.badge && (
            <p className="mt-3 inline-block rounded-full bg-primary-soft px-3 py-1 text-sm font-bold text-primary">{product.badge}</p>
          )}

          <VariantPicker product={product} variants={variants} paymentMethods={paymentMethods} />

          {product.description && (
            <section className="mt-10 border-t border-border pt-6">
              <h2 className="font-display text-xl font-bold">Descripción</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-muted">{product.description}</p>
            </section>
          )}
          <p className="mt-6 rounded-2xl bg-primary-soft p-4 text-sm text-foreground">
            Sumalo al carrito y mandanos el pedido por WhatsApp: te confirmamos precio, stock y entrega.
          </p>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-24">
          <SectionHeading title="También te puede gustar" />
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
