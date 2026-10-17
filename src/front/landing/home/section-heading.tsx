import { Leaf } from "@phosphor-icons/react/dist/ssr";

/** Encabezado de sección del diseño: "— 🍃 OFERTAS —", título y bajada centrados. */
export function SectionHeading({ eyebrow, title, text, light = false }: { eyebrow?: string; title: string; text?: string; light?: boolean }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      {eyebrow && (
        <p className={`flex items-center justify-center gap-2 text-sm font-extrabold uppercase tracking-[0.15em] ${light ? "text-white/85" : "text-primary"}`}>
          <span className="h-px w-8 bg-current opacity-50" aria-hidden />
          <Leaf size={16} weight="bold" aria-hidden />
          {eyebrow}
          <span className="h-px w-8 bg-current opacity-50" aria-hidden />
        </p>
      )}
      <h2 className={`mt-2 font-display text-3xl font-bold sm:text-4xl ${light ? "text-white" : "text-foreground"}`}>{title}</h2>
      {text && <p className={`mt-3 ${light ? "text-white/85" : "text-muted"}`}>{text}</p>}
    </div>
  );
}
