import { LoadingRegion, Skeleton } from "@/front/shared/ui/skeleton";

/** Esqueleto de la tienda: se muestra al instante mientras llegan los productos. */
export function ShopLoading() {
  return (
    <LoadingRegion className="mx-auto max-w-[82rem] px-4 pt-10 sm:px-6">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-10 w-48" />
      <div className="mt-6 flex gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <Skeleton className="mt-6 h-16 w-full rounded-3xl" />
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </LoadingRegion>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-card)] bg-surface p-3 shadow-sm">
      <Skeleton className="aspect-[4/3] w-full" />
      <div className="px-2 pb-1 pt-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-2 h-4 w-4/5" />
        <div className="mt-5 flex items-end justify-between">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="size-10 rounded-full" />
        </div>
      </div>
    </div>
  );
}
