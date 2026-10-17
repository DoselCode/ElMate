import Image from "next/image";
import { Leaf } from "@phosphor-icons/react/dist/ssr";

/** Foto del producto o, si todavía no tiene, un fondo de marca con una hoja. */
export function ProductImage({
  src,
  alt,
  sizes,
  priority = false,
  className = "",
}: {
  src: string | null | undefined;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-[#f7f5ef] ${className}`}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[#f8f6f0] to-[#eef3e6]" aria-hidden>
          <Leaf size={44} weight="duotone" className="text-primary/40" />
        </div>
      )}
    </div>
  );
}

/** Miniatura cuadrada para el carrito. */
export function ProductThumb({ src, alt }: { src: string | null; alt: string }) {
  return <ProductImage src={src} alt={alt} sizes="64px" className="size-16 shrink-0 rounded-xl" />;
}
