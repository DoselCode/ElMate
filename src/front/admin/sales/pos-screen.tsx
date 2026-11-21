"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { CheckCircle, MagnifyingGlass, Minus, Package, Plus, Receipt, ShoppingCartSimple, Tag, Trash, Warning } from "@phosphor-icons/react";
import { createSaleAction } from "@/back/admin/sales/actions";
import { Button, buttonClass } from "@/front/shared/ui/button";
import { Modal } from "@/front/shared/ui/modal";
import { inputClass } from "@/front/shared/ui/field";
import { formatMoney, formatQuantity, parseDecimal } from "@/shared/format";
import type { PaymentMethod, SellableItem } from "@/shared/types";
import { clearPosDraft, updatePosDraft, usePosDraft, type DiscountType, type Line } from "./pos-draft";

/**
 * Descuento como lo calcula la base (create_sale): en % sobre el importe o en monto fijo,
 * nunca más que el importe. null = valor inválido; 0 = sin descuento.
 */
function discountOf(base: number, type: DiscountType, text: string): number | null {
  if (text.trim() === "") return 0;
  const v = parseDecimal(text);
  if (!Number.isFinite(v) || v < 0) return null;
  if (type === "pct") return v > 100 ? null : cents((base * v) / 100);
  return v > base ? null : v;
}

const cents = (n: number) => Math.round(n * 100) / 100;
const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const PAGE_SIZE = 24;

/** Controla stock y no queda nada: no se puede vender. */
const outOfStock = (i: SellableItem) => i.track_stock && i.stock <= 0;
const labelOf = (i: SellableItem) => `${i.product_name}${i.variant_label ? ` · ${i.variant_label}` : ""}`;

function validQty(n: number, unit: SellableItem["unit"]) {
  return Number.isFinite(n) && n > 0 && (unit === "kg" ? Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6 : Number.isInteger(n));
}

/** Total con el ajuste de una forma de pago, igual que la base (create_sale). */
function totalFor(base: number, method: PaymentMethod | undefined) {
  const adjustment = method ? cents((base * method.adjustment_pct) / 100) : 0;
  return { adjustment, total: cents(base + adjustment) };
}

const pct = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)} %`;

export function PosScreen({
  items,
  methods,
  cashOpen,
  isAdmin,
}: {
  items: SellableItem[];
  methods: PaymentMethod[];
  cashOpen: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  // La venta en curso vive en pos-draft: sobrevive a cambiar de módulo y a recargar la página
  const draft = usePosDraft();
  // Las líneas guardadas se actualizan con el precio y el stock de ahora; si un producto ya no se vende, sale
  const lines = useMemo(() => {
    const byId = new Map(items.map((i) => [i.variant_id, i]));
    return draft.lines.flatMap((l) => {
      const item = byId.get(l.item.variant_id);
      return item ? [{ ...l, item }] : [];
    });
  }, [draft.lines, items]);
  const { discount, discountType, customer, notes } = draft;
  const defaultMethodId = methods.find((m) => m.is_cash)?.id ?? methods[0]?.id ?? "";
  const methodId = draft.methodId && methods.some((m) => m.id === draft.methodId) ? draft.methodId : defaultMethodId;
  const setLines = (next: Line[] | ((ls: Line[]) => Line[])) =>
    updatePosDraft((d) => ({ ...d, lines: typeof next === "function" ? next(d.lines) : next }));
  const setDiscount = (value: string) => updatePosDraft((d) => ({ ...d, discount: value }));
  const setDiscountType = (value: DiscountType) => updatePosDraft((d) => ({ ...d, discountType: value }));
  const setMethodId = (value: string) => updatePosDraft((d) => ({ ...d, methodId: value }));
  const setCustomer = (value: string) => updatePosDraft((d) => ({ ...d, customer: value }));
  const setNotes = (value: string) => updatePosDraft((d) => ({ ...d, notes: value }));
  const [error, setError] = useState<string>();
  /** Aviso al intentar agregar algo sin stock (se muestra bajo el buscador). */
  const [notice, setNotice] = useState<string>();
  const [done, setDone] = useState<{ saleId: string; ticketNumber: number; total: number } | null>(null);
  const [pending, startTransition] = useTransition();
  /** Arrastrando un producto: se resalta el carrito como destino. */
  const [dragging, setDragging] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // ---- búsqueda ---------------------------------------------------------------------------
  const filtered = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    const found = words.length
      ? items.filter((i) => {
          const text = normalize(`${i.product_name} ${i.variant_label} ${i.sku} ${i.barcode ?? ""} ${i.brand ?? ""}`);
          return words.every((w) => text.includes(w));
        })
      : items;
    // Los que no tienen stock van al final (el orden entre los demás se mantiene)
    return [...found].sort((a, b) => Number(outOfStock(a)) - Number(outOfStock(b)));
  }, [items, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function add(item: SellableItem) {
    setDone(null);
    setError(undefined);
    // El stock se valida acá, antes de agregar, no recién al cobrar
    if (outOfStock(item)) {
      setNotice(`No hay stock de ${labelOf(item)}: no se puede agregar.`);
      searchRef.current?.focus();
      return;
    }
    const found = lines.find((l) => l.item.variant_id === item.variant_id);
    if (found && item.unit === "unidad" && item.track_stock && (parseDecimal(found.qty) || 0) + 1 > item.stock) {
      setNotice(`Solo hay ${formatQuantity(item.stock, item.unit)} de ${labelOf(item)}: ya agregaste todos los que hay.`);
      setQuery("");
      searchRef.current?.focus();
      return;
    }
    setNotice(undefined);
    setLines((ls) => {
      const existing = ls.find((l) => l.item.variant_id === item.variant_id);
      if (existing && item.unit === "unidad") {
        return ls.map((l) => (l === existing ? { ...l, qty: String((parseDecimal(l.qty) || 0) + 1) } : l));
      }
      if (existing) return ls; // por kg: se edita el peso en la línea
      return [...ls, { item, qty: item.unit === "kg" ? "" : "1", discountType: "pct", discount: "", showDiscount: false }];
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
    // Sin código exacto, el primer resultado que tenga stock (si ninguno tiene, el primero: avisa que no hay)
    const pick = exact ?? filtered.find((i) => !outOfStock(i)) ?? filtered[0];
    if (pick) add(pick);
  }

  // ---- totales ----------------------------------------------------------------------------
  const parsedLines = lines.map((l) => {
    const qty = parseDecimal(l.qty);
    const ok = validQty(qty, l.item.unit);
    const gross = ok ? cents(l.item.price * qty) : 0;
    const lineDiscount = discountOf(gross, l.discountType, l.discount);
    const over = l.item.track_stock && ok && qty > l.item.stock;
    return { ...l, qtyNumber: qty, ok, over, gross, lineDiscount, lineTotal: cents(gross - (lineDiscount ?? 0)) };
  });
  const subtotal = cents(parsedLines.reduce((s, l) => s + l.lineTotal, 0));
  const discountAmount = discountOf(subtotal, discountType, discount);
  const discountOk = discountAmount !== null;
  const base = cents(subtotal - (discountAmount ?? 0));
  const method = methods.find((m) => m.id === methodId);
  const { adjustment, total } = totalFor(base, method);
  const hasOver = parsedLines.some((l) => l.over);
  const canCharge =
    cashOpen && lines.length > 0 && parsedLines.every((l) => l.ok && l.lineDiscount !== null) && !hasOver && discountOk && Boolean(method);
  const setLine = (variantId: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((x) => (x.item.variant_id === variantId ? { ...x, ...patch } : x)));

  function charge() {
    if (!canCharge) return;
    setError(undefined);
    startTransition(async () => {
      const res = await createSaleAction({
        paymentMethodId: methodId,
        items: parsedLines.map((l) => ({
          variantId: l.item.variant_id,
          quantity: l.qtyNumber,
          discount: l.lineDiscount ? { type: l.discountType, value: parseDecimal(l.discount) } : null,
        })),
        discount: { type: discountType, value: discountAmount ? parseDecimal(discount) : 0 },
        customer,
        notes,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone({ saleId: res.saleId, ticketNumber: res.ticketNumber, total });
      clearPosDraft();
      router.refresh(); // stock actualizado para la próxima venta
      searchRef.current?.focus();
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Nueva venta</h1>
        {isAdmin && (
          <Link href="/admin/ventas" className={buttonClass("ghost")}>
            <Receipt size={18} aria-hidden /> Ventas del día
          </Link>
        )}
      </header>

      {!cashOpen && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warning-soft px-5 py-4 text-sm text-warning">
          <p className="flex items-center gap-2 font-semibold">
            <Warning size={20} aria-hidden /> La caja está cerrada: abrila para poder cobrar.
          </p>
          <Link href="/admin/caja" className={buttonClass("primary", "sm")}>Abrir caja</Link>
        </div>
      )}

      {/* Venta registrada: aviso en un modal, con acceso al ticket */}
      <Modal
        open={done !== null}
        onClose={() => {
          setDone(null);
          searchRef.current?.focus();
        }}
        title="Venta registrada"
      >
        {done && (
          <div className="space-y-5">
            <p role="status" className="flex items-center gap-3 rounded-2xl bg-success-soft px-4 py-4 font-semibold text-success">
              <CheckCircle size={28} weight="fill" aria-hidden className="shrink-0" />
              <span>
                Venta N° {done.ticketNumber} registrada · {formatMoney(done.total)}
              </span>
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                data-autofocus
                onClick={() => {
                  setDone(null);
                  searchRef.current?.focus();
                }}
              >
                Nueva venta
              </Button>
              <Link href={`/admin/ventas/${done.saleId}`} className={buttonClass("primary")}>
                <Receipt size={18} aria-hidden /> Ver ticket
              </Link>
            </div>
          </div>
        )}
      </Modal>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_27rem]">
        <section aria-label="Productos de la venta" className="space-y-4">
          {/* Buscador */}
          <div>
            <label htmlFor="pos-search" className="sr-only">Buscar producto</label>
            <div className="relative">
              <MagnifyingGlass size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <input
                ref={searchRef}
                id="pos-search"
                type="search"
                autoFocus
                autoComplete="off"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                  setNotice(undefined);
                }}
                onKeyDown={onSearchKey}
                placeholder="Buscá por nombre o código, o escaneá el código de barras"
                className={`${inputClass} rounded-2xl py-3.5 pl-12 text-base`}
                aria-controls="pos-products"
              />
            </div>
            {notice && (
              <p role="alert" className="mt-2 flex items-center gap-2 rounded-xl bg-danger-soft px-4 py-2.5 text-sm font-semibold text-danger">
                <Warning size={18} aria-hidden /> {notice}
              </p>
            )}
          </div>

          {/* Productos: paginados y con scroll propio (el buscador, el paginador y el carrito quedan a la vista);
              los que no tienen stock se ven grises y no se pueden agregar */}
          <div id="pos-products" aria-label="Productos" className="space-y-3">
            {filtered.length === 0 ? (
              <p className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-muted">No hay productos con “{query}”.</p>
            ) : (
              <ul
                key={currentPage}
                className="grid max-h-[60svh] grid-cols-2 content-start gap-2 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-3 lg:max-h-[calc(100svh-17rem)] xl:grid-cols-4 2xl:grid-cols-5"
              >
                {pageItems.map((i) => {
                  const out = outOfStock(i);
                  return (
                    <li key={i.variant_id}>
                      {/* div y no button: Firefox no deja arrastrar un botón */}
                      <div
                        role="button"
                        tabIndex={out ? -1 : 0}
                        aria-disabled={out}
                        aria-label={out ? `${labelOf(i)}: sin stock` : `Agregar ${labelOf(i)} al carrito`}
                        draggable={!out}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", i.variant_id);
                          e.dataTransfer.effectAllowed = "copy";
                          setDragging(true);
                        }}
                        onDragEnd={() => {
                          setDragging(false);
                          setDragOver(false);
                        }}
                        onClick={() => !out && add(i)}
                        onKeyDown={(e) => {
                          if (!out && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            add(i);
                          }
                        }}
                        className={`flex h-full select-none flex-col overflow-hidden rounded-2xl text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                          out
                            ? "cursor-not-allowed bg-background text-muted opacity-60 grayscale"
                            : "cursor-grab bg-surface hover:-translate-y-0.5 hover:bg-primary-soft hover:shadow-md active:cursor-grabbing"
                        }`}
                      >
                        <CardPhoto src={i.image} />
                        <span className="flex flex-1 flex-col gap-0.5 p-2">
                          <span className={`line-clamp-2 text-[0.8rem] font-semibold leading-snug ${out ? "" : "text-foreground"}`}>
                            {i.product_name}
                            {i.variant_label && <span className="font-normal text-muted"> · {i.variant_label}</span>}
                          </span>
                          <span className="truncate text-[0.7rem] text-muted">
                            <span className="font-mono">{i.sku}</span>
                            {out ? " · Sin stock" : i.track_stock ? ` · Stock: ${formatQuantity(i.stock, i.unit)}` : ""}
                          </span>
                          <span className="mt-auto pt-0.5 text-sm font-bold tabular-nums">
                            {formatMoney(i.price)}
                            {i.unit === "kg" && <span className="text-xs font-normal text-muted"> por kg</span>}
                          </span>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {pageCount > 1 && (
              <nav aria-label="Páginas de productos" className="flex items-center justify-between gap-3 text-sm">
                <p className="text-muted">
                  {filtered.length} {filtered.length === 1 ? "producto" : "productos"} · página {currentPage} de {pageCount}
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                    Anterior
                  </Button>
                  <Button variant="secondary" size="sm" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>
                    Siguiente
                  </Button>
                </div>
              </nav>
            )}
          </div>

        </section>

        {/* Carrito: se le arrastran los productos (o se tocan) y de acá se cobra */}
        <aside
          aria-label="Carrito y cobro"
          onDragOver={(e) => {
            if (!dragging) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData("text/plain");
            setDragOver(false);
            setDragging(false);
            const item = items.find((x) => x.variant_id === id);
            if (item) add(item);
          }}
          className={`space-y-4 rounded-[var(--radius-card)] p-5 shadow-sm transition lg:sticky lg:top-6 lg:max-h-[calc(100svh-3rem)] lg:overflow-y-auto ${
            dragOver ? "bg-primary-soft ring-4 ring-primary/40" : dragging ? "bg-surface ring-2 ring-primary/30" : "bg-surface"
          }`}
        >
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <ShoppingCartSimple size={22} className="text-primary" aria-hidden /> Carrito
            {lines.length > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">{lines.length}</span>
            )}
          </h2>

          {lines.length === 0 ? (
            <div
              className={`rounded-2xl border-2 border-dashed p-8 text-center text-sm ${
                dragOver ? "border-primary text-primary" : "border-border-strong text-muted"
              }`}
            >
              <ShoppingCartSimple size={32} className="mx-auto mb-2" aria-hidden />
              Arrastrá los productos hasta acá, o tocalos, para armar la venta.
            </div>
          ) : (
            <ul className="space-y-2">
              {parsedLines.map((l) => {
                const over = l.over;
                const id = `qty-${l.item.variant_id}`;
                const setQty = (qty: string) => setLine(l.item.variant_id, { qty });
                return (
                  <li key={l.item.variant_id} className="rounded-2xl bg-background p-2.5">
                    <div className="flex items-start gap-2.5">
                      <Thumb src={l.item.image} />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold">
                          {l.item.product_name}
                          {l.item.variant_label && <span className="font-normal text-muted"> · {l.item.variant_label}</span>}
                        </p>
                        <p className="text-xs text-muted">
                          {formatMoney(l.item.price)}
                          {l.item.unit === "kg" ? " por kg" : " c/u"}
                          {over && <span className="font-semibold text-danger"> · máximo {formatQuantity(l.item.stock, l.item.unit)}</span>}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLines((ls) => ls.filter((x) => x.item.variant_id !== l.item.variant_id))}
                        aria-label={`Quitar ${l.item.product_name}`}
                        className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash size={16} aria-hidden />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
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
                          className={`w-16 rounded-xl border bg-surface px-2 py-1.5 text-center text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                            l.ok ? "border-border-strong" : "border-danger"
                          }`}
                        />
                        {l.item.unit === "kg" ? (
                          <span className="text-xs text-muted">kg</span>
                        ) : (
                          <button
                            type="button"
                            className="grid size-8 cursor-pointer place-items-center rounded-full hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Sumar uno de ${l.item.product_name}`}
                            title={l.item.track_stock && l.ok && l.qtyNumber >= l.item.stock ? "No hay más stock" : undefined}
                            disabled={l.item.track_stock && l.ok && l.qtyNumber >= l.item.stock}
                            onClick={() => setQty(String((l.ok ? l.qtyNumber : 0) + 1))}
                          >
                            <Plus size={14} weight="bold" aria-hidden />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="text-right">
                          {l.lineDiscount ? <p className="text-xs text-muted line-through tabular-nums">{formatMoney(l.gross)}</p> : null}
                          <p className="text-sm font-bold tabular-nums">{l.ok ? formatMoney(l.lineTotal) : "—"}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLine(l.item.variant_id, { showDiscount: !l.showDiscount })}
                          aria-label={`Descuento para ${l.item.product_name}`}
                          aria-expanded={l.showDiscount}
                          title="Descuento"
                          className={`grid size-8 cursor-pointer place-items-center rounded-full hover:bg-primary-soft hover:text-primary ${
                            l.lineDiscount ? "bg-primary-soft text-primary" : "text-muted"
                          }`}
                        >
                          <Tag size={16} aria-hidden />
                        </button>
                      </div>
                    </div>
                    {l.showDiscount && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-dashed border-border pt-2 text-sm">
                        <span className="text-muted">Descuento</span>
                        <DiscountInput
                          id={`disc-${l.item.variant_id}`}
                          label={`Descuento para ${l.item.product_name}`}
                          type={l.discountType}
                          value={l.discount}
                          invalid={l.lineDiscount === null}
                          onChange={(discountType, value) => setLine(l.item.variant_id, { discountType, discount: value })}
                        />
                        {l.lineDiscount === null ? (
                          <span role="alert" className="text-xs font-medium text-danger">
                            {l.discountType === "pct" ? "Entre 0 y 100 %" : "No puede superar el importe"}
                          </span>
                        ) : l.lineDiscount > 0 ? (
                          <span className="text-xs text-muted tabular-nums">−{formatMoney(l.lineDiscount)}</span>
                        ) : null}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="font-semibold tabular-nums">{formatMoney(subtotal)}</dd>
            </div>
          </dl>

          <div>
            <p id="pos-discount-label" className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Descuento sobre el total</p>
            <div className="flex items-center gap-2">
              <DiscountInput
                id="pos-discount"
                label="Descuento sobre el total"
                type={discountType}
                value={discount}
                invalid={!discountOk}
                wide
                onChange={(type, value) => {
                  setDiscountType(type);
                  setDiscount(value);
                }}
              />
              {discountAmount ? <span className="text-sm text-muted tabular-nums">−{formatMoney(discountAmount)}</span> : null}
            </div>
            {!discountOk && (
              <p role="alert" className="mt-1 text-xs font-medium text-danger">
                {discountType === "pct" ? "Entre 0 y 100 %" : "No puede superar el subtotal"}
              </p>
            )}
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

          {hasOver && (
            <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-danger">
              Hay productos que superan el stock disponible. Bajá la cantidad para poder cobrar.
            </p>
          )}
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

/** Campo de descuento con selector % / $ (por línea o sobre el total). */
function DiscountInput({
  id,
  label,
  type,
  value,
  invalid,
  wide = false,
  onChange,
}: {
  id: string;
  label: string;
  type: DiscountType;
  value: string;
  invalid: boolean;
  wide?: boolean;
  onChange: (type: DiscountType, value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <label htmlFor={id} className="sr-only">{label} ({type === "pct" ? "porcentaje" : "monto en pesos"})</label>
      <input
        id={id}
        inputMode="decimal"
        value={value}
        placeholder="0"
        onChange={(e) => onChange(type, e.target.value)}
        aria-invalid={invalid}
        className={`${wide ? "w-28" : "w-20"} rounded-xl border px-2.5 py-1.5 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 ${
          invalid ? "border-danger" : "border-border-strong"
        }`}
      />
      <div role="group" aria-label={`Tipo de ${label.toLowerCase()}`} className="inline-flex rounded-full bg-background p-0.5">
        {(["pct", "amount"] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={type === t}
            onClick={() => onChange(t, value)}
            className={`min-w-8 cursor-pointer rounded-full px-2 py-1 text-xs font-bold ${
              type === t ? "bg-primary text-white" : "text-muted hover:text-foreground"
            }`}
          >
            {t === "pct" ? "%" : "$"}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Foto grande de la tarjeta de producto. */
function CardPhoto({ src }: { src: string | null }) {
  return (
    <span className="relative block aspect-[16/10] w-full bg-background">
      {src ? (
        <Image src={src} alt="" fill sizes="(min-width: 1280px) 10rem, (min-width: 640px) 12rem, 45vw" draggable={false} className="object-cover" />
      ) : (
        <span className="grid size-full place-items-center text-muted" aria-hidden>
          <Package size={32} />
        </span>
      )}
    </span>
  );
}
