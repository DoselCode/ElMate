"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Printer, Prohibit } from "@phosphor-icons/react";
import { voidSaleAction } from "@/back/admin/sales/actions";
import { Badge } from "@/front/shared/ui/badge";
import { Button, buttonClass } from "@/front/shared/ui/button";
import { TextField } from "@/front/shared/ui/field";
import { Modal } from "@/front/shared/ui/modal";
import { formatDateTime, formatMoney, formatQuantity } from "@/shared/format";
import type { SaleDetail } from "@/shared/types";

const pct = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)} %`;

/** Ticket de una venta (imprimible, no válido como factura) y anulación para el admin. */
export function SaleDetailScreen({ detail, isAdmin }: { detail: SaleDetail; isAdmin: boolean }) {
  const { sale, items, store } = detail;
  const [voiding, setVoiding] = useState(false);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/admin/ventas" className={buttonClass("ghost")}>Volver a ventas</Link>
        <div className="flex gap-2">
          {isAdmin && sale.status === "pagada" && (
            <Button variant="secondary" onClick={() => setVoiding(true)}>
              <Prohibit size={18} aria-hidden /> Anular
            </Button>
          )}
          <Button onClick={() => window.print()}>
            <Printer size={18} aria-hidden /> Imprimir ticket
          </Button>
        </div>
      </header>

      {sale.status === "anulada" && (
        <p role="status" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger print:hidden">
          Venta anulada{sale.void_reason ? `: ${sale.void_reason}` : ""}. El stock se devolvió al inventario.
        </p>
      )}

      <article className="rounded-[var(--radius-card)] bg-surface p-6 font-mono text-sm shadow-sm print:p-0 print:shadow-none">
        <div className="text-center">
          <p className="font-display text-xl font-bold">{store.name}</p>
          {store.legal_name && <p>{store.legal_name}</p>}
          {store.cuit && <p>CUIT {store.cuit}{store.tax_condition ? ` · ${store.tax_condition}` : ""}</p>}
          {store.address && <p>{store.address}</p>}
          {store.phone && <p>Tel. {store.phone}</p>}
        </div>

        <div className="my-4 border-t border-dashed border-border-strong" />
        <div className="flex justify-between gap-3">
          <p className="font-bold">Ticket N° {String(sale.ticket_number).padStart(6, "0")}</p>
          {sale.status === "anulada" && <Badge tone="danger">ANULADA</Badge>}
        </div>
        <p>{formatDateTime(sale.created_at)}</p>
        {sale.seller_name && <p>Atendió: {sale.seller_name}</p>}
        {sale.customer_name && <p>Cliente: {sale.customer_name}</p>}

        <div className="my-4 border-t border-dashed border-border-strong" />
        <ul className="space-y-2">
          {items.map((i, n) => (
            <li key={n}>
              <p>
                {i.product_name}
                {i.variant_label && ` (${i.variant_label})`}
              </p>
              <p className="flex justify-between gap-3 text-muted print:text-foreground">
                <span>
                  {formatQuantity(i.quantity, i.unit)} × {formatMoney(i.unit_price)}
                </span>
                <span className="text-foreground">{formatMoney(i.line_total)}</span>
              </p>
            </li>
          ))}
        </ul>

        <div className="my-4 border-t border-dashed border-border-strong" />
        <dl className="space-y-1">
          <Row label="Subtotal" value={formatMoney(sale.subtotal)} />
          {sale.discount_amount > 0 && <Row label="Descuento" value={`−${formatMoney(sale.discount_amount)}`} />}
          {sale.adjustment_amount !== 0 && (
            <Row label={`${sale.payment_method_name} ${pct(sale.adjustment_pct)}`} value={formatMoney(sale.adjustment_amount)} />
          )}
          <div className="flex justify-between pt-1 text-lg font-bold">
            <dt>TOTAL</dt>
            <dd>{formatMoney(sale.total)}</dd>
          </div>
          <Row label="Forma de pago" value={sale.payment_method_name} />
        </dl>
        {sale.notes && <p className="mt-3">Nota: {sale.notes}</p>}

        <div className="my-4 border-t border-dashed border-border-strong" />
        <p className="text-center text-xs font-bold uppercase">Documento no válido como factura</p>
        <p className="mt-1 text-center text-xs">¡Gracias por tu compra!</p>
      </article>

      <Modal open={voiding} onClose={() => setVoiding(false)} title={`¿Anular la venta N° ${sale.ticket_number}?`}>
        <VoidForm saleId={sale.id} onCancel={() => setVoiding(false)} />
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function VoidForm({ saleId, onCancel }: { saleId: string; onCancel: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const res = await voidSaleAction({ saleId, reason });
      if (!res.ok) {
        setError(res.fieldErrors?.reason ?? res.error);
        return;
      }
      onCancel();
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <p className="text-sm text-muted">
        La venta queda registrada como anulada, los productos vuelven al stock y deja de sumar en la caja.
      </p>
      <TextField
        id="void-reason"
        label="Motivo"
        data-autofocus
        maxLength={200}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        error={error}
        placeholder="Ej: error de carga, devolución"
      />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>Cancelar</Button>
        <Button type="submit" variant="danger" disabled={pending}>{pending ? "Anulando…" : "Anular venta"}</Button>
      </div>
    </form>
  );
}
