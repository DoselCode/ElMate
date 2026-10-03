"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PencilSimple, PlusCircle, SlidersHorizontal, Package } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import type { StockRow } from "@/lib/types";
import { StockAdjustDialog, StockInDialog } from "./stock-dialogs";

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-background text-muted" aria-hidden>
        <Package size={20} />
      </div>
    );
  }
  return <Image src={src} alt={alt} width={44} height={44} className="size-11 shrink-0 rounded-xl object-cover" />;
}

function StockCell({ row }: { row: StockRow }) {
  if (row.stock === 0) return <Badge tone="danger">Sin stock</Badge>;
  return (
    <div className="flex items-center gap-2">
      <span className="font-semibold tabular-nums">{row.stock}</span>
      {row.low_stock && <Badge tone="warning">Bajo · mín. {row.min_stock}</Badge>}
    </div>
  );
}

export function StockTable({
  rows,
  canManage,
  showCost,
}: {
  rows: StockRow[];
  canManage: boolean;
  showCost: boolean;
}) {
  const [stockIn, setStockIn] = useState<StockRow | null>(null);
  const [adjust, setAdjust] = useState<StockRow | null>(null);
  const [notice, setNotice] = useState("");

  // El aviso desaparece solo
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const btn =
    "grid size-9 cursor-pointer place-items-center rounded-full text-muted transition-colors hover:bg-primary-soft hover:text-primary";

  return (
    <>
      <div role="status" aria-live="polite" className="mb-3 empty:hidden">
        {notice && <p className="rounded-xl bg-success-soft px-4 py-2.5 text-sm font-medium text-success">{notice}</p>}
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-card)] bg-surface shadow-sm">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <caption className="sr-only">Inventario de productos y variantes</caption>
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-5 py-3.5 font-bold">Producto</th>
              <th scope="col" className="px-3 py-3.5 font-bold">Proveedor</th>
              <th scope="col" className="px-3 py-3.5 text-right font-bold">Precio</th>
              {showCost && <th scope="col" className="px-3 py-3.5 text-right font-bold">Costo</th>}
              <th scope="col" className="px-3 py-3.5 font-bold">Stock</th>
              <th scope="col" className="px-3 py-3.5 font-bold">Estado</th>
              {canManage && <th scope="col" className="px-5 py-3.5 text-right font-bold">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.variant_id} className="border-b border-dashed border-border last:border-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Thumb src={row.image} alt="" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{row.product_name}</p>
                      <p className="truncate text-xs text-muted">
                        {row.variant_label && <span>{row.variant_label} · </span>}
                        <span className="font-mono">{row.sku}</span>
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-muted">{row.supplier_name ?? "—"}</td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatMoney(row.price)}</td>
                {showCost && <td className="px-3 py-3 text-right tabular-nums text-muted">{formatMoney(row.cost)}</td>}
                <td className="px-3 py-3"><StockCell row={row} /></td>
                <td className="px-3 py-3">
                  {!row.active ? (
                    <Badge tone="neutral">Inactiva</Badge>
                  ) : row.is_visible ? (
                    <Badge tone="success">Visible</Badge>
                  ) : (
                    <Badge tone="warning">Oculto</Badge>
                  )}
                </td>
                {canManage && (
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className={btn}
                        title="Registrar ingreso"
                        aria-label={`Registrar ingreso de ${row.product_name} ${row.variant_label}`}
                        onClick={() => setStockIn(row)}
                      >
                        <PlusCircle size={20} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={btn}
                        title="Ajustar stock"
                        aria-label={`Ajustar stock de ${row.product_name} ${row.variant_label}`}
                        onClick={() => setAdjust(row)}
                      >
                        <SlidersHorizontal size={20} aria-hidden />
                      </button>
                      <Link
                        href={`/admin/stock/${row.product_id}`}
                        className={btn}
                        title="Editar producto"
                        aria-label={`Editar ${row.product_name}`}
                      >
                        <PencilSimple size={20} aria-hidden />
                      </Link>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <StockInDialog row={stockIn} onClose={() => setStockIn(null)} onDone={setNotice} />
      <StockAdjustDialog row={adjust} onClose={() => setAdjust(null)} onDone={setNotice} />
    </>
  );
}
