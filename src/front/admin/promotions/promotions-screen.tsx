import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/front/shared/ui/badge";
import { buttonClass } from "@/front/shared/ui/button";
import { EmptyState } from "@/front/shared/ui/empty-state";
import type { PromotionRow, PromotionStatus } from "@/shared/types";

const STATUS: Record<PromotionStatus, { label: string; tone: "success" | "warning" | "neutral" | "danger" }> = {
  vigente: { label: "Vigente", tone: "success" },
  programada: { label: "Programada", tone: "warning" },
  pausada: { label: "Pausada", tone: "neutral" },
  terminada: { label: "Terminada", tone: "danger" },
};

const dateFormat = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

/** Listado de promociones: estado, fechas y cantidad de productos. */
export function PromotionsScreen({ promotions }: { promotions: PromotionRow[] }) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Promociones</h1>
          <p className="mt-1 text-sm text-muted">
            Precios especiales por producto entre dos fechas (Cyber Monday, Día del Padre…). Se aplican solas en la web y pueden tener su card en la home.
          </p>
        </div>
        <Link href="/admin/promociones/nueva" className={buttonClass("primary")}>
          <Plus size={18} weight="bold" aria-hidden /> Nueva promoción
        </Link>
      </header>

      {promotions.length === 0 ? (
        <EmptyState title="Todavía no hay promociones" text="Creá la primera: elegí los productos, su precio especial y las fechas." />
      ) : (
        <ul className="space-y-3">
          {promotions.map((p) => {
            const status = STATUS[p.status];
            return (
              <li key={p.id}>
                <Link
                  href={`/admin/promociones/${p.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] bg-surface p-5 shadow-sm transition-colors hover:bg-primary-soft"
                >
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-bold">{p.name}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {dateFormat.format(new Date(p.starts_at))} → {p.ends_at ? dateFormat.format(new Date(p.ends_at)) : "sin fecha de fin"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted">
                      {p.item_count} {p.item_count === 1 ? "producto" : "productos"}
                    </span>
                    {p.show_card && <Badge>Card en la home</Badge>}
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
