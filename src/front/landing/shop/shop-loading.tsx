import { LoadingRegion, Skeleton } from "@/front/shared/ui/skeleton";

/** Esqueleto de la tienda: se muestra al instante mientras llegan los productos. */
export function ShopLoading() {
  return (
    <LoadingRegion className="mx-auto max-w-[85rem] px-4 pt-10 sm:px-6">
      <Skeleton className="h-4 w-32" />
      <div className="mt-4 flex items-center justify-between gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-40 rounded-full" />
      </div>
      <div className="mt-6 lg:grid lg:grid-cols-[16rem_1fr] lg:gap-10">
        <div className="hidden space-y-6 lg:block">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div>
          <Skeleton className="h-11 w-full rounded-full" />
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
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
