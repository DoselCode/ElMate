"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass, inputErrorClass } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { formatMoney, formatSigned } from "@/lib/format";
import type { StockRow } from "@/lib/types";
import { adjustStockAction, registerStockInAction } from "./actions";

/** "12" → 12, "" → NaN (el esquema lo rechaza con un mensaje claro). */
const num = (s: string) => (s.trim() === "" ? Number.NaN : Number(s));

function VariantHeader({ row }: { row: StockRow }) {
  return (
    <div className="mb-4 rounded-xl bg-background p-3 text-sm">
      <p className="font-semibold">{row.product_name}</p>
      <p className="text-muted">
        {row.variant_label ? `${row.variant_label} · ` : ""}
        <span className="font-mono">{row.sku}</span> · stock actual <strong className="text-foreground">{row.stock}</strong>
      </p>
    </div>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-danger">
      {message}
    </p>
  );
}

export function StockInDialog({
  row,
  onClose,
  onDone,
}: {
  row: StockRow | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  return (
    <Modal open={row !== null} onClose={onClose} title="Registrar ingreso">
      {row && <StockInForm key={row.variant_id} row={row} onClose={onClose} onDone={onDone} />}
    </Modal>
  );
}

function StockInForm({ row, onClose, onDone }: { row: StockRow; onClose: () => void; onDone: (m: string) => void }) {
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const qty = num(quantity);
  const preview = Number.isInteger(qty) && qty > 0 ? row.stock + qty : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setFields({});
    startTransition(async () => {
      const res = await registerStockInAction({
        variantId: row.variant_id,
        quantity: qty,
        unitCost: unitCost.trim() === "" ? null : num(unitCost),
        reason,
      });
      if (!res.ok) {
        setError(res.fieldErrors ? undefined : res.error);
        setFields(res.fieldErrors ?? {});
        return;
      }
      onDone(`Ingreso registrado: +${qty} · ${row.product_name}${row.variant_label ? ` (${row.variant_label})` : ""}`);
      onClose();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <VariantHeader row={row} />
      <Field label="Cantidad que ingresa" htmlFor="in-qty" error={fields.quantity} hint={preview !== null ? `El stock pasa de ${row.stock} a ${preview}` : undefined}>
        <input
          id="in-qty"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          data-autofocus
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          aria-invalid={Boolean(fields.quantity)}
          aria-describedby={fields.quantity ? "in-qty-error" : undefined}
          className={`${inputClass} ${fields.quantity ? inputErrorClass : ""}`}
        />
      </Field>
      <Field
        label="Costo unitario de esta compra (opcional)"
        htmlFor="in-cost"
        error={fields.unitCost}
        hint={`Si lo completás, reemplaza el costo actual (${formatMoney(row.cost)})`}
      >
        <input
          id="in-cost"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={unitCost}
          onChange={(e) => setUnitCost(e.target.value)}
          aria-invalid={Boolean(fields.unitCost)}
          aria-describedby={fields.unitCost ? "in-cost-error" : undefined}
          className={`${inputClass} ${fields.unitCost ? inputErrorClass : ""}`}
        />
      </Field>
      <Field label="Nota (opcional)" htmlFor="in-reason" error={fields.reason}>
        <input
          id="in-reason"
          type="text"
          maxLength={200}
          placeholder="Ej: compra a proveedor, remito 0012"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={inputClass}
        />
      </Field>
      <FormError message={error} />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Registrar ingreso"}
        </Button>
      </div>
    </form>
  );
}

type Mode = "count" | "delta";

export function StockAdjustDialog({
  row,
  onClose,
  onDone,
}: {
  row: StockRow | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  return (
    <Modal open={row !== null} onClose={onClose} title="Ajustar stock">
      {row && <StockAdjustForm key={row.variant_id} row={row} onClose={onClose} onDone={onDone} />}
    </Modal>
  );
}

const REASON_SUGGESTIONS = ["Rotura", "Faltante", "Producto vencido", "Diferencia de inventario", "Devolución a proveedor"];

function StockAdjustForm({ row, onClose, onDone }: { row: StockRow; onClose: () => void; onDone: (m: string) => void }) {
  const [mode, setMode] = useState<Mode>("count");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const n = num(value);
  const delta = Number.isInteger(n) ? (mode === "count" ? n - row.stock : n) : null;
  const result = delta !== null ? row.stock + delta : null;
  const valueKey = mode === "count" ? "counted" : "delta";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setFields({});
    startTransition(async () => {
      const res = await adjustStockAction(
        mode === "count"
          ? { mode, variantId: row.variant_id, counted: n, reason }
          : { mode, variantId: row.variant_id, delta: n, reason },
      );
      if (!res.ok) {
        setError(res.fieldErrors ? undefined : res.error);
        setFields(res.fieldErrors ?? {});
        return;
      }
      const label = `${row.product_name}${row.variant_label ? ` (${row.variant_label})` : ""}`;
      onDone(res.delta === 0 ? `Sin cambios: el stock ya era ${row.stock} · ${label}` : `Stock ajustado ${formatSigned(res.delta)} · ${label}`);
      onClose();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <VariantHeader row={row} />

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">¿Cómo querés ajustar?</legend>
        <div className="grid grid-cols-2 gap-1 rounded-full bg-background p-1">
          {(
            [
              ["count", "Recuento"],
              ["delta", "Sumar / restar"],
            ] as const
          ).map(([m, label]) => (
            <label
              key={m}
              className={`cursor-pointer rounded-full px-3 py-2 text-center text-sm font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
                mode === m ? "bg-primary text-white" : "text-muted hover:text-foreground"
              }`}
            >
              <input
                type="radio"
                name="mode"
                value={m}
                checked={mode === m}
                onChange={() => {
                  setMode(m);
                  setValue("");
                  setFields({});
                }}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label={mode === "count" ? "Stock real contado" : "Cantidad (negativa para restar)"}
        htmlFor="adj-value"
        error={fields[valueKey]}
        hint={
          delta !== null && result !== null
            ? delta === 0
              ? "No hay diferencia con el stock actual"
              : `Diferencia ${formatSigned(delta)} · el stock queda en ${result}${result < 0 ? " (no es posible)" : ""}`
            : mode === "count"
              ? "Contá lo que hay físicamente y cargá ese número"
              : "Ej: −2 por rotura, +1 por una unidad encontrada"
        }
      >
        <input
          id="adj-value"
          type="number"
          inputMode="numeric"
          step={1}
          min={mode === "count" ? 0 : undefined}
          data-autofocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={Boolean(fields[valueKey])}
          aria-describedby={fields[valueKey] ? "adj-value-error" : undefined}
          className={`${inputClass} ${fields[valueKey] ? inputErrorClass : ""}`}
        />
      </Field>

      <Field
        label={mode === "count" ? "Motivo (opcional)" : "Motivo"}
        htmlFor="adj-reason"
        error={fields.reason}
      >
        <input
          id="adj-reason"
          type="text"
          list="adj-reasons"
          maxLength={200}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={Boolean(fields.reason)}
          aria-describedby={fields.reason ? "adj-reason-error" : undefined}
          className={`${inputClass} ${fields.reason ? inputErrorClass : ""}`}
        />
        <datalist id="adj-reasons">
          {REASON_SUGGESTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </Field>

      <FormError message={error} />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar ajuste"}
        </Button>
      </div>
    </form>
  );
}
