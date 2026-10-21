import { LoadingRegion, Skeleton } from "@/front/shared/ui/skeleton";

/** Esqueleto de la ficha de producto. */
export function ProductLoading() {
  return (
    <LoadingRegion className="mx-auto max-w-[85rem] px-4 pt-10 sm:px-6">
      <Skeleton className="h-4 w-56" />
      <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-14">
        <Skeleton className="aspect-square w-full rounded-[2rem]" />
        <div>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-3 h-10 w-4/5" />
          <Skeleton className="mt-6 h-9 w-40" />
          <Skeleton className="mt-8 h-4 w-24" />
          <div className="mt-3 flex gap-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-24 rounded-full" />
            ))}
          </div>
          <Skeleton className="mt-8 h-12 w-64 rounded-full" />
          <Skeleton className="mt-10 h-24 w-full" />
        </div>
      </div>
    </LoadingRegion>
  );
}
