import Link from "next/link";
import { buildQuery } from "@/shared/query";

/** Paginación por links (funciona sin JS). `params` son los filtros vigentes a conservar. */
export function Pagination({
  basePath,
  page,
  pageSize,
  total,
  params,
}: {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const href = (p: number) => `${basePath}${buildQuery({ ...params, page: p > 1 ? p : undefined })}`;
  const link = "rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold hover:bg-primary-soft";
  const disabled = "rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted/60";

  return (
    <nav aria-label="Paginación" className="mt-4 flex items-center justify-between gap-3">
      <p className="text-sm text-muted">
        Página {page} de {pages} · {total} resultados
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={link} rel="prev">
            Anterior
          </Link>
        ) : (
          <span className={disabled} aria-disabled="true">
            Anterior
          </span>
        )}
        {page < pages ? (
          <Link href={href(page + 1)} className={link} rel="next">
            Siguiente
          </Link>
        ) : (
          <span className={disabled} aria-disabled="true">
            Siguiente
          </span>
        )}
      </div>
    </nav>
  );
}
