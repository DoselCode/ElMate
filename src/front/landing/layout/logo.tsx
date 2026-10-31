import Image from "next/image";
import Link from "next/link";
import { BrandLetterRow } from "./brand-letters";

/**
 * Logo de la marca: ELMATE en una línea sobre la foto de un mate real (el cuerpo de calabaza de
 * /landing/hero.jpg, ampliado), con la A azul inclinada como en el logo original.
 */
export function Logo({ name = "ElMate", className = "h-12 w-44" }: { name?: string; className?: string }) {
  return (
    <Link
      href="/"
      aria-label={`${name}, ir al inicio`}
      className={`relative isolate flex shrink-0 items-center justify-center overflow-hidden rounded-full shadow-md ${className}`}
    >
      <Image
        src="/landing/hero.jpg"
        alt=""
        fill
        sizes="176px"
        className="-z-20 origin-[45%_50%] scale-[1.9] object-cover"
        style={{ objectPosition: "50% 66%" }}
      />
      <span className="absolute inset-0 -z-10 bg-primary-deep/45" aria-hidden />
      <BrandLetterRow fill="#ffffff" blue="#4aa8e8" className="h-[42%] w-auto drop-shadow-[0_1px_2px_rgb(0_0_0/0.6)]" />
    </Link>
  );
}
