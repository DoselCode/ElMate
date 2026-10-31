import type { ReactNode } from "react";
import { ProductImage } from "./product-image";

type Kind = "mate" | "termo" | "bombilla" | "yerba" | "yerbera" | "combo" | "bolso" | "grabado" | "default";

/** Elige la ilustración según el nombre/slug de la categoría ("bolsos-materos" → bolso). El orden importa: "yerbera" antes que "yerba". */
function kindOf(slug: string): Kind {
  const s = slug.toLowerCase();
  if (s.includes("combo")) return "combo";
  if (s.includes("yerbera")) return "yerbera";
  if (s.includes("yerba")) return "yerba";
  if (s.includes("bombilla")) return "bombilla";
  if (s.includes("termo") || s.includes("termic")) return "termo";
  if (s.includes("bolso") || s.includes("mochila") || s.includes("matera")) return "bolso";
  if (s.includes("grabado") || s.includes("personaliz")) return "grabado";
  if (s.includes("mate")) return "mate";
  return "default";
}

const STEEL = "url(#ca-steel)";
const LEATHER = "url(#ca-leather)";

function Mate({ x = 0, y = 0, s = 1 }: { x?: number; y?: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M52 100C52 150 78 176 100 176S148 150 148 100Z" fill={LEATHER} />
      <path d="M56 124C76 134 124 134 144 124" stroke="#1a7fc7" strokeWidth="4" strokeLinecap="round" fill="none" />
      <ellipse cx="100" cy="100" rx="48" ry="12" fill="#2a1b12" stroke="#cfd6de" strokeWidth="3" />
      <path d="M58 100C74 78 126 78 142 100Z" fill="#7f9c3d" />
      <path d="M112 96 146 44" stroke="#d7dde4" strokeWidth="4" strokeLinecap="round" />
      <circle cx="147" cy="43" r="4.5" fill="#d7dde4" />
    </g>
  );
}

function Termo({ x = 0, y = 0, s = 1 }: { x?: number; y?: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="66" y="40" width="68" height="132" rx="16" fill={STEEL} />
      <rect x="66" y="82" width="68" height="12" fill="#1a7fc7" />
      <rect x="66" y="152" width="68" height="20" rx="12" fill="#0b1119" />
      <rect x="72" y="22" width="56" height="22" rx="8" fill="#0b1119" />
      <rect x="70" y="34" width="60" height="6" rx="3" fill="#1a7fc7" />
      <rect x="91" y="15" width="18" height="8" rx="3" fill="#0b1119" />
      <rect x="76" y="48" width="7" height="100" rx="3.5" fill="#fff" opacity="0.35" />
    </g>
  );
}

const ART: Record<Kind, ReactNode> = {
  mate: <Mate x={0} y={4} />,
  termo: <Termo />,
  bombilla: (
    <g strokeLinecap="round" fill="none">
      <path d="M64 168 138 40" stroke="#d7dde4" strokeWidth="6" />
      <ellipse cx="62" cy="170" rx="11" ry="7" transform="rotate(-60 62 170)" fill="#9aa7b6" stroke="#d7dde4" strokeWidth="3" />
      <circle cx="140" cy="37" r="7" fill="#d7dde4" stroke="none" />
      <path d="M94 168 156 62" stroke="#1a7fc7" strokeWidth="6" />
      <ellipse cx="92" cy="170" rx="11" ry="7" transform="rotate(-60 92 170)" fill="#0f4f7e" stroke="#1a7fc7" strokeWidth="3" />
      <circle cx="158" cy="59" r="7" fill="#1a7fc7" stroke="none" />
    </g>
  ),
  yerba: (
    <g>
      <path d="M56 54 144 54 154 168C154 172 150 176 146 176H54C50 176 46 172 46 168Z" fill="#2f6b3a" />
      <path d="M56 54 144 54 143 66H57Z" fill="#1f4a28" />
      <rect x="62" y="92" width="76" height="52" rx="8" fill="#0b1119" />
      <path d="M100 100c-12 6-16 18-8 30 12-2 20-14 8-30Z" fill="#7fbf4a" />
      <rect x="72" y="134" width="56" height="4" rx="2" fill="#1a7fc7" />
    </g>
  ),
  yerbera: (
    <g>
      <rect x="54" y="62" width="92" height="112" rx="14" fill={STEEL} />
      <rect x="48" y="40" width="104" height="28" rx="10" fill="#0b1119" />
      <rect x="92" y="28" width="16" height="14" rx="5" fill="#1a7fc7" />
      <rect x="54" y="100" width="92" height="14" fill="#1a7fc7" />
      <rect x="64" y="70" width="8" height="96" rx="4" fill="#fff" opacity="0.35" />
    </g>
  ),
  combo: (
    <g>
      <Termo x={-26} y={14} s={0.72} />
      <Mate x={34} y={30} s={0.8} />
      <path d="M44 150h112v24H44z" fill="#1a7fc7" />
      <path d="M100 150v24" stroke="#0b1119" strokeWidth="6" />
      <path d="M100 150c-16-14-30-4-22 4M100 150c16-14 30-4 22 4" stroke="#0b1119" strokeWidth="5" strokeLinecap="round" fill="none" />
    </g>
  ),
  bolso: (
    <g fill="none" strokeLinecap="round">
      <path d="M72 66c0-34 56-34 56 0" stroke="#d7dde4" strokeWidth="7" />
      <path d="M56 70H144L156 168C156 174 152 178 146 178H54C48 178 44 174 44 168Z" fill="#0b1119" stroke="#1a7fc7" strokeWidth="4" />
      <rect x="66" y="108" width="68" height="34" rx="8" fill="#16283a" stroke="#1a7fc7" strokeWidth="3" />
      <circle cx="100" cy="125" r="6" fill="#1a7fc7" stroke="none" />
    </g>
  ),
  grabado: (
    <g strokeLinecap="round" strokeLinejoin="round">
      <path d="M52 150 62 112 128 46 154 72 88 138Z" fill="#e9eef4" stroke="#9aa7b6" strokeWidth="3" />
      <path d="M128 46 154 72 170 56C174 52 174 46 170 42L158 30C154 26 148 26 144 30Z" fill="#1a7fc7" />
      <path d="M52 150 62 112 88 138Z" fill="#0b1119" />
      <path d="M40 176h120" stroke="#1a7fc7" strokeWidth="5" fill="none" />
      <path d="M44 100l-8-8M36 116H24M50 86l-4-10" stroke="#7cc4ff" strokeWidth="4" fill="none" />
    </g>
  ),
  default: (
    <g>
      <circle cx="100" cy="100" r="62" fill="#1a7fc7" />
      <path d="M72 128C70 88 96 66 132 68 134 104 112 130 72 128ZM72 128 114 86" stroke="#0b1119" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="#e9eef4" />
    </g>
  ),
};

/** Ilustración de relleno de una categoría (hasta que tenga foto propia), en el estilo negro y azul de la marca. */
export function CategoryArt({ slug, className = "" }: { slug: string; className?: string }) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden className={className}>
      <defs>
        <radialGradient id="ca-glow" cx="50%" cy="62%" r="60%">
          <stop offset="0" stopColor="#1a7fc7" stopOpacity="0.45" />
          <stop offset="1" stopColor="#1a7fc7" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ca-steel" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#7d8896" />
          <stop offset="0.45" stopColor="#e9eef4" />
          <stop offset="1" stopColor="#8b96a4" />
        </linearGradient>
        <linearGradient id="ca-leather" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#a8754a" />
          <stop offset="1" stopColor="#573620" />
        </linearGradient>
      </defs>
      <rect width="200" height="200" fill="#0b1119" />
      <rect width="200" height="200" fill="url(#ca-glow)" />
      {ART[kindOf(slug)]}
    </svg>
  );
}

/** Foto (de la categoría o del producto) o, si todavía no tiene, la ilustración de relleno de su categoría. */
export function CategoryImage({
  src,
  slug,
  sizes,
  className = "",
}: {
  src: string | null | undefined;
  slug: string;
  sizes: string;
  className?: string;
}) {
  if (src) return <ProductImage src={src} alt="" sizes={sizes} className={className} />;
  return (
    <div className={`overflow-hidden bg-[#0b1119] ${className}`}>
      <CategoryArt slug={slug} className="size-full" />
    </div>
  );
}
