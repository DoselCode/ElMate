"use client";

import { useState, useTransition } from "react";
import { adjustStockAction, registerStockInAction } from "@/back/admin/stock/actions";
import { Button } from "@/front/shared/ui/button";
import { Field, inputClass, inputErrorClass } from "@/front/shared/ui/field";
import { Modal } from "@/front/shared/ui/modal";
import { formatMoney, formatQuantity, parseDecimal } from "@/shared/format";
import type { StockRow } from "@/shared/types";

/** "12" o "0,25" → número; "" → NaN (el esquema lo rechaza con un mensaje claro). */
const num = (s: string) => (s.trim() === "" ? Number.NaN : parseDecimal(s));
/** Evita arrastrar errores de coma flotante (0,1 + 0,2) en las vistas previas. */
const round3 = (n: number) => Math.round(n * 1000) / 1000;
/** Cantidad válida para la unidad: entera por unidad, hasta 3 decimales por kg. */
const validFor = (n: number, unit: StockRow["unit"]) =>
  Number.isFinite(n) && (unit === "kg" ? Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6 : Number.isInteger(n));

function VariantHeader({ row }: { row: StockRow }) {
  return (
    <div className="mb-4 rounded-xl bg-background p-3 text-sm">
      <p className="font-semibold">{row.product_name}</p>
      <p className="text-muted">
        {row.variant_label ? `${row.variant_label} · ` : ""}
        <span className="font-mono">{row.sku}</span> · stock actual{" "}
        <strong className="text-foreground">{formatQuantity(row.stock, row.unit)}</strong>
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
  const preview = validFor(qty, row.unit) && qty > 0 ? round3(row.stock + qty) : null;

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
      onDone(
        `Ingreso registrado: ${formatQuantity(qty, row.unit, { signed: true })} · ${row.product_name}${row.variant_label ? ` (${row.variant_label})` : ""}`,
      );
      onClose();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <VariantHeader row={row} />
      <Field
        label={row.unit === "kg" ? "Kilos que ingresan" : "Cantidad que ingresa"}
        htmlFor="in-qty"
        error={fields.quantity}
        hint={
          preview !== null
            ? `El stock pasa de ${formatQuantity(row.stock, row.unit)} a ${formatQuantity(preview, row.unit)}`
            : row.unit === "kg"
              ? "Con decimales: 2,5"
              : undefined
        }
      >
        <input
          id="in-qty"
          type="text"
          inputMode={row.unit === "kg" ? "decimal" : "numeric"}
          autoComplete="off"
          data-autofocus
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          aria-invalid={Boolean(fields.quantity)}
          aria-describedby={fields.quantity ? "in-qty-error" : undefined}
          className={`${inputClass} ${fields.quantity ? inputErrorClass : ""}`}
        />
      </Field>
      <Field
        label={row.unit === "kg" ? "Costo por kg de esta compra (opcional)" : "Costo unitario de esta compra (opcional)"}
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
  const delta = validFor(n, row.unit) ? round3(mode === "count" ? n - row.stock : n) : null;
  const result = delta !== null ? round3(row.stock + delta) : null;
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
      onDone(
        res.delta === 0
          ? `Sin cambios: el stock ya era ${formatQuantity(row.stock, row.unit)} · ${label}`
          : `Stock ajustado ${formatQuantity(res.delta, row.unit, { signed: true })} · ${label}`,
      );
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
              : `Diferencia ${formatQuantity(delta, row.unit, { signed: true })} · el stock queda en ${formatQuantity(result, row.unit)}${result < 0 ? " (no es posible)" : ""}`
            : mode === "count"
              ? "Contá lo que hay físicamente y cargá ese número"
              : "Ej: −2 por rotura, +1 por una unidad encontrada"
        }
      >
        <input
          id="adj-value"
          type="text"
          inputMode={row.unit === "kg" ? "decimal" : "numeric"}
          autoComplete="off"
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
