"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { CheckCircle, MagnifyingGlass, Minus, Package, Plus, Receipt, Trash, Warning } from "@phosphor-icons/react";
import { createSaleAction } from "@/back/admin/sales/actions";
import { Button, buttonClass } from "@/front/shared/ui/button";
import { inputClass } from "@/front/shared/ui/field";
import { formatMoney, formatQuantity, parseDecimal } from "@/shared/format";
import type { PaymentMethod, SellableItem } from "@/shared/types";

/** Línea del carrito de venta. La cantidad se guarda como texto (lo que tipea quien vende). */
type Line = { item: SellableItem; qty: string };

const cents = (n: number) => Math.round(n * 100) / 100;
const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const MAX_RESULTS = 8;

function validQty(n: number, unit: SellableItem["unit"]) {
  return Number.isFinite(n) && n > 0 && (unit === "kg" ? Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6 : Number.isInteger(n));
}

/** Total con el ajuste de una forma de pago, igual que la base (create_sale). */
function totalFor(base: number, method: PaymentMethod | undefined) {
  const adjustment = method ? cents((base * method.adjustment_pct) / 100) : 0;
  return { adjustment, total: cents(base + adjustment) };
}

const pct = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)} %`;

export function PosScreen({ items, methods, cashOpen }: { items: SellableItem[]; methods: PaymentMethod[]; cashOpen: boolean }) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState("");
  const [methodId, setMethodId] = useState(methods.find((m) => m.is_cash)?.id ?? methods[0]?.id ?? "");
  const [customer, setCustomer] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<{ saleId: string; ticketNumber: number; total: number } | null>(null);
  const [pending, startTransition] = useTransition();

  // ---- búsqueda ---------------------------------------------------------------------------
  const results = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return items
      .filter((i) => {
        const text = normalize(`${i.product_name} ${i.variant_label} ${i.sku} ${i.barcode ?? ""} ${i.brand ?? ""}`);
        return words.every((w) => text.includes(w));
      })
      .slice(0, MAX_RESULTS);
  }, [items, query]);

  function add(item: SellableItem) {
    setDone(null);
    setError(undefined);
    setLines((ls) => {
      const found = ls.find((l) => l.item.variant_id === item.variant_id);
      if (found && item.unit === "unidad") {
        return ls.map((l) => (l === found ? { ...l, qty: String((parseDecimal(l.qty) || 0) + 1) } : l));
      }
      if (found) return ls; // por kg: se edita el peso en la línea
      return [...ls, { item, qty: item.unit === "kg" ? "" : "1" }];
    });
    setQuery("");
    searchRef.current?.focus();
  }

  /** Enter: código exacto (lector de código de barras) o el primer resultado. */
  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = query.trim().toUpperCase();
    const exact = items.find((i) => i.barcode === query.trim() || i.sku.toUpperCase() === code);
    const pick = exact ?? results[0];
    if (pick) add(pick);
  }

  // ---- totales ----------------------------------------------------------------------------
  const parsedLines = lines.map((l) => {
    const qty = parseDecimal(l.qty);
    const ok = validQty(qty, l.item.unit);
    return { ...l, qtyNumber: qty, ok, lineTotal: ok ? cents(l.item.price * qty) : 0 };
  });
  const subtotal = cents(parsedLines.reduce((s, l) => s + l.lineTotal, 0));
  const discountNumber = discount.trim() === "" ? 0 : parseDecimal(discount);
  const discountOk = Number.isFinite(discountNumber) && discountNumber >= 0 && discountNumber <= subtotal;
  const base = cents(subtotal - (discountOk ? discountNumber : 0));
  const method = methods.find((m) => m.id === methodId);
  const { adjustment, total } = totalFor(base, method);
  const canCharge = cashOpen && lines.length > 0 && parsedLines.every((l) => l.ok) && discountOk && Boolean(method);

  function charge() {
    if (!canCharge) return;
    setError(undefined);
    startTransition(async () => {
      const res = await createSaleAction({
        paymentMethodId: methodId,
        items: parsedLines.map((l) => ({ variantId: l.item.variant_id, quantity: l.qtyNumber })),
        discount: discountOk ? discountNumber : 0,
        customer,
        notes,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone({ saleId: res.saleId, ticketNumber: res.ticketNumber, total });
      setLines([]);
      setDiscount("");
      setCustomer("");
      setNotes("");
      router.refresh(); // stock actualizado para la próxima venta
      searchRef.current?.focus();
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Nueva venta</h1>
        <Link href="/admin/ventas" className={buttonClass("ghost")}>
          <Receipt size={18} aria-hidden /> Ventas del día
        </Link>
      </header>

      {!cashOpen && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warning-soft px-5 py-4 text-sm text-warning">
          <p className="flex items-center gap-2 font-semibold">
            <Warning size={20} aria-hidden /> La caja está cerrada: abrila para poder cobrar.
          </p>
          <Link href="/admin/caja" className={buttonClass("primary", "sm")}>Abrir caja</Link>
        </div>
      )}

      {done && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-success-soft px-5 py-4 text-sm text-success">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle size={22} weight="fill" aria-hidden />
            Venta N° {done.ticketNumber} registrada · {formatMoney(done.total)}
          </p>
          <Link href={`/admin/ventas/${done.saleId}`} className={buttonClass("secondary", "sm")}>
            Ver ticket
          </Link>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label="Productos de la venta" className="space-y-4">
          {/* Buscador */}
          <div className="relative">
            <label htmlFor="pos-search" className="sr-only">Buscar producto</label>
            <MagnifyingGlass size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input
              ref={searchRef}
              id="pos-search"
              type="search"
              autoFocus
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder="Buscá por nombre o código, o escaneá el código de barras"
              className={`${inputClass} rounded-2xl py-3.5 pl-12 text-base`}
              aria-controls="pos-results"
            />
            {query.trim() && (
              <ul
                id="pos-results"
                className="absolute inset-x-0 top-full z-20 mt-2 max-h-96 overflow-y-auto rounded-2xl border border-border bg-surface p-1.5 shadow-xl"
              >
                {results.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-muted">No hay productos con “{query}”.</li>
                ) : (
                  results.map((i) => {
                    const out = i.track_stock && i.stock <= 0;
                    return (
                      <li key={i.variant_id}>
                        <button
                          type="button"
                          onClick={() => add(i)}
                          className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-primary-soft"
                        >
                          <Thumb src={i.image} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {i.product_name}
                              {i.variant_label && <span className="font-normal text-muted"> · {i.variant_label}</span>}
                            </span>
                            <span className="block truncate text-xs text-muted">
                              <span className="font-mono">{i.sku}</span>
                              {i.track_stock ? ` · stock ${formatQuantity(i.stock, i.unit)}` : " · sin control de stock"}
                            </span>
                          </span>
                          <span className="text-right">
                            <span className="block text-sm font-bold tabular-nums">{formatMoney(i.price)}</span>
                            {i.unit === "kg" && <span className="block text-xs text-muted">por kg</span>}
                            {out && <span className="block text-xs font-semibold text-danger">Sin stock</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>

          {/* Líneas */}
          {lines.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border-2 border-dashed border-border-strong p-10 text-center text-sm text-muted">
              Buscá un producto para empezar la venta.
            </div>
          ) : (
            <ul className="space-y-2">
              {parsedLines.map((l) => {
                const over = l.item.track_stock && l.ok && l.qtyNumber > l.item.stock;
                const id = `qty-${l.item.variant_id}`;
                const setQty = (qty: string) =>
                  setLines((ls) => ls.map((x) => (x.item.variant_id === l.item.variant_id ? { ...x, qty } : x)));
                return (
                  <li key={l.item.variant_id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-3 shadow-sm sm:flex-nowrap">
                    <Thumb src={l.item.image} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {l.item.product_name}
                        {l.item.variant_label && <span className="font-normal text-muted"> · {l.item.variant_label}</span>}
                      </p>
                      <p className="text-xs text-muted">
                        {formatMoney(l.item.price)}
                        {l.item.unit === "kg" ? " por kg" : " c/u"}
                        {over && <span className="font-semibold text-danger"> · hay {formatQuantity(l.item.stock, l.item.unit)}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {l.item.unit === "unidad" && (
                        <button
                          type="button"
                          className="grid size-8 cursor-pointer place-items-center rounded-full hover:bg-primary-soft disabled:opacity-40"
                          aria-label={`Restar uno de ${l.item.product_name}`}
                          disabled={!l.ok || l.qtyNumber <= 1}
                          onClick={() => setQty(String(l.qtyNumber - 1))}
                        >
                          <Minus size={14} weight="bold" aria-hidden />
                        </button>
                      )}
                      <label htmlFor={id} className="sr-only">
                        {l.item.unit === "kg" ? "Kilos" : "Cantidad"} de {l.item.product_name}
                      </label>
                      <input
                        id={id}
                        value={l.qty}
                        inputMode={l.item.unit === "kg" ? "decimal" : "numeric"}
                        autoFocus={l.item.unit === "kg" && l.qty === ""}
                        placeholder={l.item.unit === "kg" ? "0,250" : "1"}
                        onChange={(e) => setQty(e.target.value)}
                        aria-invalid={!l.ok}
                        className={`w-20 rounded-xl border px-2 py-1.5 text-center text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                          l.ok ? "border-border-strong" : "border-danger"
                        }`}
                      />
                      {l.item.unit === "kg" ? (
                        <span className="text-xs text-muted">kg</span>
                      ) : (
                        <button
                          type="button"
                          className="grid size-8 cursor-pointer place-items-center rounded-full hover:bg-primary-soft"
                          aria-label={`Sumar uno de ${l.item.product_name}`}
                          onClick={() => setQty(String((l.ok ? l.qtyNumber : 0) + 1))}
                        >
                          <Plus size={14} weight="bold" aria-hidden />
                        </button>
                      )}
                    </div>
                    <p className="w-24 text-right text-sm font-bold tabular-nums">{l.ok ? formatMoney(l.lineTotal) : "—"}</p>
                    <button
                      type="button"
                      onClick={() => setLines((ls) => ls.filter((x) => x.item.variant_id !== l.item.variant_id))}
                      aria-label={`Quitar ${l.item.product_name}`}
                      className="grid size-8 cursor-pointer place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash size={16} aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Cobro */}
        <aside aria-label="Cobro" className="space-y-4 rounded-[var(--radius-card)] bg-surface p-5 shadow-sm lg:sticky lg:top-6">
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal (lista)</dt>
              <dd className="font-semibold tabular-nums">{formatMoney(subtotal)}</dd>
            </div>
          </dl>

          <div>
            <label htmlFor="pos-discount" className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">Descuento ($)</label>
            <input
              id="pos-discount"
              inputMode="decimal"
              value={discount}
              placeholder="0"
              onChange={(e) => setDiscount(e.target.value)}
              aria-invalid={!discountOk}
              className={`${inputClass} ${discountOk ? "" : "border-danger"}`}
            />
            {!discountOk && <p role="alert" className="mt-1 text-xs font-medium text-danger">No puede superar el subtotal</p>}
          </div>

          <fieldset>
            <legend className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Forma de pago</legend>
            <div className="space-y-1.5">
              {methods.map((m) => {
                const t = totalFor(base, m).total;
                return (
                  <label
                    key={m.id}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/30 ${
                      m.id === methodId ? "border-primary bg-primary-soft font-semibold" : "border-border hover:bg-background"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="method"
                        value={m.id}
                        checked={m.id === methodId}
                        onChange={() => setMethodId(m.id)}
                        className="accent-primary"
                      />
                      {m.name}
                      {m.adjustment_pct !== 0 && <span className="text-xs font-normal text-muted">{pct(m.adjustment_pct)}</span>}
                    </span>
                    <span className="tabular-nums">{formatMoney(t)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-2">
            <label htmlFor="pos-customer" className="sr-only">Cliente (opcional)</label>
            <input
              id="pos-customer"
              value={customer}
              maxLength={80}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Cliente (opcional)"
              className={inputClass}
            />
            <label htmlFor="pos-notes" className="sr-only">Nota (opcional)</label>
            <input
              id="pos-notes"
              value={notes}
              maxLength={300}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Nota (opcional): seña, envío…"
              className={inputClass}
            />
          </div>

          <div className="border-t border-dashed border-border pt-4">
            {adjustment !== 0 && method && (
              <p className="flex justify-between text-sm text-muted">
                <span>{method.name} {pct(method.adjustment_pct)}</span>
                <span className="tabular-nums">{formatMoney(adjustment)}</span>
              </p>
            )}
            <p className="mt-1 flex items-baseline justify-between">
              <span className="font-semibold">Total</span>
              <span className="font-display text-3xl font-bold tabular-nums">{formatMoney(total)}</span>
            </p>
          </div>

          {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-danger">{error}</p>}

          <Button className="w-full py-3 text-base" disabled={!canCharge || pending} onClick={charge}>
            {pending ? "Registrando…" : `Cobrar ${formatMoney(total)}`}
          </Button>
          {lines.length > 0 && (
            <button
              type="button"
              onClick={() => setLines([])}
              className="w-full cursor-pointer text-center text-xs font-semibold text-muted underline-offset-2 hover:text-danger hover:underline"
            >
              Vaciar venta
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

function Thumb({ src }: { src: string | null }) {
  if (!src) {
    return (
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background text-muted" aria-hidden>
        <Package size={18} />
      </span>
    );
  }
  return <Image src={src} alt="" width={40} height={40} className="size-10 shrink-0 rounded-xl object-cover" />;
}
