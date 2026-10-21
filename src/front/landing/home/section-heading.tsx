import { Leaf } from "@phosphor-icons/react/dist/ssr";

/** Encabezado de sección del diseño: "— 🍃 OFERTAS —", título y bajada centrados. */
/** `compact`: título y márgenes más chicos (para secciones dentro de un panel, como Categorías). */
export type SectionHeadingProps = { eyebrow?: string; title: string; text?: string; light?: boolean; compact?: boolean };

export function SectionHeading({ eyebrow, title, text, light = false, compact = false }: SectionHeadingProps) {
  return (
    <div className={`mx-auto max-w-2xl text-center ${compact ? "mb-6" : "mb-10"}`}>
      {eyebrow && (
        <p className={`flex items-center justify-center gap-2 text-sm font-extrabold uppercase tracking-[0.15em] ${light ? "text-white/85" : "text-primary"}`}>
          <span className="fx-line-l h-px w-8 bg-current opacity-50" aria-hidden />
          <Leaf size={16} weight="bold" className="fx-leaf" aria-hidden />
          {eyebrow}
          <span className="fx-line-r h-px w-8 bg-current opacity-50" aria-hidden />
        </p>
      )}
      <h2 className={`fx-steam-title mt-2 font-display font-bold ${compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"} ${light ? "text-white" : "text-foreground"}`}>{title}</h2>
      {text && <p className={`${compact ? "mt-2 text-sm" : "mt-3"} ${light ? "text-white/85" : "text-muted"}`}>{text}</p>}
    </div>
  );
}
