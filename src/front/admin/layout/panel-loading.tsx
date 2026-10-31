import { LoadingRegion, Skeleton } from "@/front/shared/ui/skeleton";

/** Esqueleto genérico de las secciones del panel: el menú lateral queda fijo y esto ocupa el contenido. */
export function PanelLoading() {
  return (
    <LoadingRegion className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <TableSkeleton rows={8} />
    </LoadingRegion>
  );
}

/** Filas de tabla en gris: se usa mientras llega el listado (también dentro de un Suspense). */
export function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}

/** Tarjetas de resumen (Variantes activas / Stock bajo / Sin stock). */
export function SummarySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-hidden>
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-[5.5rem]" />
      ))}
    </div>
  );
}

/** Inventario: título, tarjetas, barra de filtros y tabla, con las mismas medidas que la pantalla real. */
export function StockLoading() {
  return (
    <LoadingRegion className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>
      <SummarySkeleton />
      <Skeleton className="h-[4.25rem] w-full rounded-xl" />
      <TableSkeleton />
    </LoadingRegion>
  );
}

/** Movimientos: título con bajada, filtros y tabla. */
export function MovementsLoading() {
  return (
    <LoadingRegion className="space-y-6">
      <div>
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-2 h-4 w-full max-w-xl" />
      </div>
      <Skeleton className="h-[4.25rem] w-full rounded-xl" />
      <TableSkeleton />
    </LoadingRegion>
  );
}

/** Crear / editar producto: formulario a todo el ancho con columna de fotos a la derecha. */
export function FormLoading() {
  return (
    <LoadingRegion className="space-y-6 pb-10">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-10 w-44 rounded-xl" />
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]">
        <Skeleton className="h-96 rounded-[var(--radius-card)]" />
        <Skeleton className="h-72 rounded-[var(--radius-card)] xl:col-start-2 xl:row-span-2 xl:row-start-1" />
        <Skeleton className="h-96 rounded-[var(--radius-card)] xl:col-start-1" />
      </div>
    </LoadingRegion>
  );
}
