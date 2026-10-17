"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus } from "@phosphor-icons/react";
import { savePaymentMethodsAction } from "@/back/admin/settings/actions";
import { Button } from "@/front/shared/ui/button";
import { inputClass, inputErrorClass } from "@/front/shared/ui/field";
import { formatMoney, parseDecimal } from "@/shared/format";
import { applyAdjustment } from "@/shared/pricing";
import type { PaymentMethod } from "@/shared/types";

type Draft = { key: string; id?: string; name: string; adjustment: string; isCash: boolean; active: boolean };

const toDraft = (m: PaymentMethod): Draft => ({
  key: m.id,
  id: m.id,
  name: m.name,
  adjustment: String(m.adjustment_pct),
  isCash: m.is_cash,
  active: m.active,
});

/** Ejemplo para ver el efecto del ajuste sobre un precio de lista. */
const EXAMPLE_LIST_PRICE = 10000;

/**
 * Formas de pago del local y su ajuste sobre el precio de lista (descuento negativo, recargo positivo).
 * No se borran: se desactivan, porque las ventas ya hechas las guardan en su historial.
 */
export function PaymentMethodsForm({ initial }: { initial: PaymentMethod[] }) {
  const [rows, setRows] = useState<Draft[]>(initial.map(toDraft));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();

  const patch = (key: string, p: Partial<Draft>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const move = (i: number, dir: -1 | 1) =>
    setRows((rs) => {
      const next = [...rs];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(undefined);
    setErrors({});
    startTransition(async () => {
      const res = await savePaymentMethodsAction(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          adjustmentPct: r.adjustment.trim() === "" ? 0 : parseDecimal(r.adjustment),
          isCash: r.isCash,
          active: r.active,
        })),
      );
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setMessage({ ok: false, text: res.fieldErrors?.[""] ?? res.error });
        return;
      }
      setMessage({ ok: true, text: "Formas de pago guardadas." });
    });
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-[var(--radius-card)] bg-surface p-6 shadow-sm">
      <h2 className="font-display text-lg font-bold">Formas de pago</h2>
      <p className="mb-4 mt-0.5 text-sm text-muted">
        El precio de los productos es el de lista; cada forma de pago aplica su ajuste al cobrar. Negativo = descuento
        (efectivo −20), positivo = recargo. La ganancia de la lista se calcula sobre el precio en efectivo.
      </p>

      <ul className="space-y-2">
        {rows.map((r, i) => {
          const adj = parseDecimal(r.adjustment || "0");
          const nameError = errors[`${i}.name`];
          const adjError = errors[`${i}.adjustmentPct`];
          return (
            <li key={r.key} className={`grid gap-2 rounded-2xl border border-border p-3 sm:grid-cols-[auto_1fr_8rem_auto] sm:items-center ${r.active ? "" : "opacity-60"}`}>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Subir ${r.name || "forma de pago"}`}
                  className="grid size-8 cursor-pointer place-items-center rounded-full text-muted hover:bg-primary-soft disabled:cursor-default disabled:opacity-30"
                >
                  <ArrowUp size={14} weight="bold" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === rows.length - 1}
                  aria-label={`Bajar ${r.name || "forma de pago"}`}
                  className="grid size-8 cursor-pointer place-items-center rounded-full text-muted hover:bg-primary-soft disabled:cursor-default disabled:opacity-30"
                >
                  <ArrowDown size={14} weight="bold" aria-hidden />
                </button>
              </div>
              <div>
                <label htmlFor={`pm-name-${r.key}`} className="sr-only">Nombre</label>
                <input
                  id={`pm-name-${r.key}`}
                  value={r.name}
                  maxLength={40}
                  onChange={(e) => patch(r.key, { name: e.target.value })}
                  placeholder="Ej: Crédito 12 cuotas"
                  aria-invalid={Boolean(nameError)}
                  className={`${inputClass} ${nameError ? inputErrorClass : ""}`}
                />
                {nameError && <p role="alert" className="mt-1 text-xs font-medium text-danger">{nameError}</p>}
              </div>
              <div>
                <label htmlFor={`pm-adj-${r.key}`} className="sr-only">Ajuste en %</label>
                <div className="flex items-center gap-1.5">
                  <input
                    id={`pm-adj-${r.key}`}
                    value={r.adjustment}
                    inputMode="decimal"
                    onChange={(e) => patch(r.key, { adjustment: e.target.value })}
                    aria-invalid={Boolean(adjError)}
                    aria-describedby={`pm-adj-${r.key}-hint`}
                    className={`${inputClass} text-right ${adjError ? inputErrorClass : ""}`}
                  />
                  <span className="text-sm text-muted">%</span>
                </div>
                <p id={`pm-adj-${r.key}-hint`} className="mt-1 text-right text-xs text-muted">
                  {adjError ?? (Number.isFinite(adj) ? `${formatMoney(EXAMPLE_LIST_PRICE)} → ${formatMoney(applyAdjustment(EXAMPLE_LIST_PRICE, adj))}` : "")}
                </p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={r.isCash} onChange={(e) => patch(r.key, { isCash: e.target.checked })} className="size-4 accent-primary" />
                  Es efectivo
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={r.active} onChange={(e) => patch(r.key, { active: e.target.checked })} className="size-4 accent-primary" />
                  Activa
                </label>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setRows((rs) => [...rs, { key: crypto.randomUUID(), name: "", adjustment: "0", isCash: false, active: true }])}
          disabled={rows.length >= 20}
        >
          <Plus size={14} weight="bold" aria-hidden /> Agregar forma de pago
        </Button>
        <div className="flex items-center gap-3">
          <p role="status" className={`text-sm font-medium ${message?.ok ? "text-success" : "text-danger"}`}>
            {message?.text}
          </p>
          <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar formas de pago"}</Button>
        </div>
      </div>
    </form>
  );
}
