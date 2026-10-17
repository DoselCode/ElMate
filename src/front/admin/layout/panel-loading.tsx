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
      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </LoadingRegion>
  );
}
