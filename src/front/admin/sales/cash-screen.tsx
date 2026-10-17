"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, LockKey, LockKeyOpen, ShoppingCart } from "@phosphor-icons/react";
import { addCashMovementAction, closeCashAction, openCashAction } from "@/back/admin/sales/actions";
import { Badge } from "@/front/shared/ui/badge";
import { Button, buttonClass } from "@/front/shared/ui/button";
import { Field, inputClass, inputErrorClass, TextField } from "@/front/shared/ui/field";
import { Modal } from "@/front/shared/ui/modal";
import { formatDateTime, formatMoney, parseDecimal } from "@/shared/format";
import type { CashState, ClosedSessionRow } from "@/shared/types";

const money = (s: string) => (s.trim() === "" ? Number.NaN : parseDecimal(s));

/** Pantalla de caja: abrir, ver el arqueo en vivo, registrar retiros/ingresos y cerrar. */
export function CashScreen({ state, history }: { state: CashState; history: ClosedSessionRow[] }) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Caja</h1>
        {state.open && (
          <Link href="/admin/ventas/nueva" className={buttonClass("primary")}>
            <ShoppingCart size={18} weight="bold" aria-hidden /> Nueva venta
          </Link>
        )}
      </header>

      {state.registerId === null ? (
        <p role="alert" className="rounded-xl bg-danger-soft p-4 text-sm font-medium text-danger">
          No hay una caja configurada en el sistema.
        </p>
      ) : state.open ? (
        <OpenCash open={state.open} />
      ) : (
        <OpenForm suggested={state.suggestedOpening} />
      )}

      <CashHistory rows={history} />
    </div>
  );
}

// ---- Abrir ---------------------------------------------------------------------------------

function OpenForm({ suggested }: { suggested: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(suggested));
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const res = await openCashAction({ openingCash: money(amount) });
      if (!res.ok) {
        setError(res.fieldErrors?.openingCash ?? res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded-[var(--radius-card)] bg-surface p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-warning-soft text-warning" aria-hidden>
          <LockKey size={22} weight="bold" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold">La caja está cerrada</h2>
          <p className="text-sm text-muted">Contá el efectivo con el que arrancás el día y abrila para empezar a vender.</p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-5 flex flex-wrap items-end gap-3" noValidate>
        <TextField
          id="opening"
          label="Efectivo inicial"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={error}
          hint={suggested > 0 ? `Al último cierre quedaron ${formatMoney(suggested)} en la caja` : undefined}
          className="w-56"
        />
        <Button type="submit" disabled={pending}>
          <LockKeyOpen size={18} weight="bold" aria-hidden /> {pending ? "Abriendo…" : "Abrir caja"}
        </Button>
      </form>
    </section>
  );
}

// ---- Caja abierta --------------------------------------------------------------------------

function OpenCash({ open }: { open: NonNullable<CashState["open"]> }) {
  const { summary, byMethod, movements } = open;
  const [closing, setClosing] = useState(false);

  return (
    <>
      <section aria-label="Arqueo" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Efectivo inicial" value={summary.opening_cash} />
        <Stat label="Ventas en efectivo" value={summary.cash_sales} />
        <Stat label="Ingresos − retiros" value={summary.cash_in - summary.cash_out} signed />
        <Stat label="Efectivo esperado en caja" value={summary.expected_cash} strong />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[var(--radius-card)] bg-surface p-6 shadow-sm">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-bold">Ventas de esta caja</h2>
            <p className="text-sm text-muted">Abierta el {formatDateTime(summary.opened_at)}</p>
          </div>
          {byMethod.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Todavía no hay ventas.</p>
          ) : (
            <ul className="mt-4 divide-y divide-dashed divide-border text-sm">
              {byMethod.map((m) => (
                <li key={m.payment_method_name} className="flex items-center justify-between py-2.5">
                  <span>
                    {m.payment_method_name}{" "}
                    <span className="text-xs text-muted">· {m.sales_count} {m.sales_count === 1 ? "venta" : "ventas"}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatMoney(m.total)}</span>
                </li>
              ))}
              <li className="flex items-center justify-between py-2.5 font-bold">
                <span>Total vendido ({summary.sales_count})</span>
                <span className="tabular-nums">{formatMoney(summary.sales_total)}</span>
              </li>
            </ul>
          )}
        </section>

        <section className="rounded-[var(--radius-card)] bg-surface p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold">Retiros e ingresos de efectivo</h2>
          <MovementForm />
          {movements.length > 0 && (
            <ul className="mt-4 divide-y divide-dashed divide-border text-sm">
              {movements.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-medium">
                      {m.type === "egreso" ? (
                        <ArrowUp size={14} weight="bold" className="text-danger" aria-hidden />
                      ) : (
                        <ArrowDown size={14} weight="bold" className="text-success" aria-hidden />
                      )}
                      {m.reason}
                    </span>
                    <span className="block text-xs text-muted">
                      {formatDateTime(m.created_at)}
                      {m.created_by_name && ` · ${m.created_by_name}`}
                    </span>
                  </span>
                  <span className={`font-semibold tabular-nums ${m.type === "egreso" ? "text-danger" : "text-success"}`}>
                    {m.type === "egreso" ? "−" : "+"}
                    {formatMoney(m.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="flex justify-end">
        <Button variant="danger" onClick={() => setClosing(true)}>
          <LockKey size={18} weight="bold" aria-hidden /> Cerrar caja
        </Button>
      </div>

      <Modal open={closing} onClose={() => setClosing(false)} title="Cerrar caja">
        <CloseForm expected={summary.expected_cash} opening={summary.opening_cash} onCancel={() => setClosing(false)} />
      </Modal>
    </>
  );
}

function Stat({ label, value, strong = false, signed = false }: { label: string; value: number; strong?: boolean; signed?: boolean }) {
  return (
    <div className={`rounded-[var(--radius-card)] p-5 shadow-sm ${strong ? "bg-primary text-white" : "bg-surface"}`}>
      <p className={`text-xs font-bold uppercase tracking-wide ${strong ? "text-white/80" : "text-muted"}`}>{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">
        {signed && value > 0 ? "+" : ""}
        {formatMoney(value)}
      </p>
    </div>
  );
}

const MOVEMENT_REASONS = ["Retiro", "Cambio", "Pago a proveedor", "Gastos varios"];

function MovementForm() {
  const router = useRouter();
  const [type, setType] = useState<"egreso" | "ingreso">("egreso");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setFields({});
    startTransition(async () => {
      const res = await addCashMovementAction({ type, amount: money(amount), reason });
      if (!res.ok) {
        setFields(res.fieldErrors ?? {});
        if (!res.fieldErrors) setError(res.error);
        return;
      }
      setAmount("");
      setReason("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr]" noValidate>
      <fieldset className="sm:col-span-2">
        <legend className="sr-only">Tipo de movimiento</legend>
        <div className="inline-grid grid-cols-2 gap-1 rounded-full bg-background p-1">
          {(
            [
              ["egreso", "Retiro"],
              ["ingreso", "Ingreso"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-center text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
                type === value ? "bg-primary text-white" : "text-muted hover:text-foreground"
              }`}
            >
              <input type="radio" name="mov-type" value={value} checked={type === value} onChange={() => setType(value)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <TextField
        id="mov-amount"
        label="Monto"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        error={fields.amount}
        className="w-36"
      />
      <Field label="Motivo" htmlFor="mov-reason" error={fields.reason}>
        <input
          id="mov-reason"
          list="mov-reasons"
          maxLength={120}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={Boolean(fields.reason)}
          aria-describedby={fields.reason ? "mov-reason-error" : undefined}
          className={`${inputClass} ${fields.reason ? inputErrorClass : ""}`}
        />
        <datalist id="mov-reasons">
          {MOVEMENT_REASONS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </Field>
      {error && <p role="alert" className="text-sm font-medium text-danger sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? "Guardando…" : type === "egreso" ? "Registrar retiro" : "Registrar ingreso"}
        </Button>
      </div>
    </form>
  );
}

// ---- Cerrar --------------------------------------------------------------------------------

function CloseForm({ expected, opening, onCancel }: { expected: number; opening: number; onCancel: () => void }) {
  const router = useRouter();
  const [counted, setCounted] = useState("");
  const [left, setLeft] = useState(String(opening));
  const [notes, setNotes] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const countedNumber = money(counted);
  const difference = Number.isFinite(countedNumber) ? Math.round((countedNumber - expected) * 100) / 100 : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setFields({});
    startTransition(async () => {
      const res = await closeCashAction({ countedCash: countedNumber, cashLeft: money(left), notes });
      if (!res.ok) {
        setFields(res.fieldErrors ?? {});
        if (!res.fieldErrors) setError(res.error);
        return;
      }
      onCancel();
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <p className="rounded-xl bg-background p-3 text-sm">
        Tendría que haber <strong className="tabular-nums">{formatMoney(expected)}</strong> en efectivo.
      </p>
      <Field
        label="Efectivo contado"
        htmlFor="close-counted"
        error={fields.countedCash}
        hint={
          difference === null
            ? "Contá los billetes y monedas de la caja"
            : difference === 0
              ? "Coincide con lo esperado"
              : `${difference > 0 ? "Sobran" : "Faltan"} ${formatMoney(Math.abs(difference))}`
        }
      >
        <input
          id="close-counted"
          inputMode="decimal"
          data-autofocus
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
          aria-invalid={Boolean(fields.countedCash)}
          className={`${inputClass} ${fields.countedCash ? inputErrorClass : ""}`}
        />
      </Field>
      <TextField
        id="close-left"
        label="Queda en la caja para mañana"
        inputMode="decimal"
        value={left}
        onChange={(e) => setLeft(e.target.value)}
        error={fields.cashLeft}
        hint="Se propone como efectivo inicial en la próxima apertura"
      />
      <TextField
        id="close-notes"
        label="Nota (opcional)"
        maxLength={300}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        error={fields.notes}
        placeholder="Ej: faltan $500 de un vuelto"
      />
      {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>Cancelar</Button>
        <Button type="submit" variant="danger" disabled={pending}>{pending ? "Cerrando…" : "Cerrar caja"}</Button>
      </div>
    </form>
  );
}

// ---- Historial -----------------------------------------------------------------------------

function CashHistory({ rows }: { rows: ClosedSessionRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-bold">Cierres anteriores</h2>
      <div className="overflow-x-auto rounded-[var(--radius-card)] bg-surface shadow-sm">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <caption className="sr-only">Cierres de caja anteriores</caption>
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-5 py-3 font-bold">Cierre</th>
              <th scope="col" className="px-3 py-3 text-right font-bold">Inicial</th>
              <th scope="col" className="px-3 py-3 text-right font-bold">Efectivo</th>
              <th scope="col" className="px-3 py-3 text-right font-bold">Otras formas</th>
              <th scope="col" className="px-3 py-3 text-right font-bold">Esperado</th>
              <th scope="col" className="px-3 py-3 text-right font-bold">Contado</th>
              <th scope="col" className="px-5 py-3 font-bold">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-dashed border-border last:border-0">
                <td className="px-5 py-3">
                  <p className="font-semibold">{formatDateTime(r.closed_at)}</p>
                  <p className="text-xs text-muted">
                    {r.closed_by_name ?? "—"}
                    {r.notes && ` · ${r.notes}`}
                  </p>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{formatMoney(r.opening_cash)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatMoney(r.cash_sales)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatMoney(r.other_sales)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatMoney(r.expected_cash)}</td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatMoney(r.counted_cash)}</td>
                <td className="px-5 py-3">
                  {r.difference === 0 ? (
                    <Badge tone="success">Justa</Badge>
                  ) : (
                    <Badge tone={r.difference < 0 ? "danger" : "warning"}>
                      {r.difference > 0 ? "Sobran " : "Faltan "}
                      {formatMoney(Math.abs(r.difference))}
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
