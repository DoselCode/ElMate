/** Bloque gris animado para las pantallas de carga (loading.tsx). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-foreground/[0.06] ${className}`} aria-hidden />;
}

/** Envoltorio accesible: anuncia "Cargando…" a lectores de pantalla una sola vez. */
export function LoadingRegion({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">Cargando…</span>
      {children}
    </div>
  );
}
