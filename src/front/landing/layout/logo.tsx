import Link from "next/link";

/** Ícono de la marca: un mate con bombilla dentro de un círculo verde (como en el diseño). */
export function MateMark({ className = "size-10" }: { className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-primary text-white ${className}`} aria-hidden>
      <svg viewBox="0 0 24 24" className="size-[55%]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 10h10v3.5a5 5 0 0 1-10 0V10Z" />
        <path d="M5.5 10h11" />
        <path d="m12.5 10 4-7.5" />
        <path d="M15.5 4.5h2.2" />
      </svg>
    </span>
  );
}

export function Logo({ name = "ElMate", light = false }: { name?: string; light?: boolean }) {
  // "ElMate" → "El" normal y "Mate" en verde, como en el diseño
  const match = /^(El)\s?(.*)$/i.exec(name);
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label={`${name}, ir al inicio`}>
      <MateMark />
      <span className={`font-display text-2xl font-bold leading-none ${light ? "text-white" : "text-foreground"}`}>
        {match ? (
          <>
            {match[1]}
            <span className={light ? "text-white" : "text-primary"}>{match[2]}</span>
          </>
        ) : (
          name
        )}
      </span>
    </Link>
  );
}
