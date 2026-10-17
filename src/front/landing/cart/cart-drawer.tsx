"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Minus, Plus, ShoppingCart, Trash, WhatsappLogo, X } from "@phosphor-icons/react";
import { inputClass } from "@/front/shared/ui/field";
import { formatMoney } from "@/shared/format";
import { MAX_QUANTITY } from "@/shared/cart";
import { buildOrderMessage, whatsappLink } from "@/shared/whatsapp";
import { ProductThumb } from "../catalog/product-image";
import { useCart } from "./cart-provider";

/**
 * Panel lateral del carrito. El pedido no se paga acá: arma el mensaje y abre WhatsApp
 * con el número del local (Datos del local, en el panel).
 */
export function CartDrawer({ whatsapp, storeName }: { whatsapp: string | null; storeName: string }) {
  const cart = useCart();
  const ref = useRef<HTMLDialogElement>(null);
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (cart.isOpen && !dialog.open) dialog.showModal();
    if (!cart.isOpen && dialog.open) dialog.close();
  }, [cart.isOpen]);

  const message = buildOrderMessage(cart.items, { storeName, customerName, notes });
  const canSend = cart.items.length > 0 && whatsapp !== null;

  return (
    <dialog
      ref={ref}
      aria-labelledby="cart-title"
      onClose={cart.close}
      onClick={(e) => {
        if (e.target === ref.current) cart.close(); // clic en el fondo
      }}
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-md bg-background p-0 text-foreground shadow-2xl"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface px-5 py-4">
          <h2 id="cart-title" className="font-display text-xl font-bold">
            Tu pedido {cart.count > 0 && <span className="text-muted">({cart.count})</span>}
          </h2>
          <button
            type="button"
            onClick={cart.close}
            aria-label="Cerrar el carrito"
            className="grid size-10 cursor-pointer place-items-center rounded-full hover:bg-primary-soft"
          >
            <X size={20} aria-hidden />
          </button>
        </header>

        {cart.items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingCart size={44} className="text-muted/60" aria-hidden />
            <p className="font-display text-lg font-bold">Tu carrito está vacío</p>
            <p className="text-sm text-muted">Sumá productos y te armamos el pedido para mandar por WhatsApp.</p>
            <Link
              href="/tienda"
              onClick={cart.close}
              className="mt-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-hover"
            >
              Ir a la tienda
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {cart.items.map((item) => (
                <li key={item.variantId} className="flex gap-3 rounded-2xl bg-surface p-3 shadow-sm">
                  <ProductThumb src={item.image} alt="" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/producto/${item.slug}`}
                      onClick={cart.close}
                      className="line-clamp-2 text-sm font-bold leading-snug hover:text-primary"
                    >
                      {item.name}
                    </Link>
                    {item.variantLabel && <p className="text-xs text-muted">{item.variantLabel}</p>}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <QuantityStepper
                        value={item.quantity}
                        onChange={(q) => cart.setQty(item.variantId, q)}
                        label={item.name}
                      />
                      <p className="font-bold tabular-nums">{formatMoney(item.price * item.quantity)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => cart.remove(item.variantId)}
                    aria-label={`Quitar ${item.name} del carrito`}
                    className="grid size-8 shrink-0 cursor-pointer place-items-center self-start rounded-full text-muted hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash size={16} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>

            <footer className="space-y-3 border-t border-border bg-surface px-5 py-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-muted">Total estimado</span>
                <span className="font-display text-2xl font-bold tabular-nums">{formatMoney(cart.total)}</span>
              </div>
              <div className="grid gap-2">
                <label htmlFor="cart-name" className="sr-only">Tu nombre (opcional)</label>
                <input
                  id="cart-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  maxLength={60}
                  placeholder="Tu nombre (opcional)"
                  autoComplete="name"
                  className={inputClass}
                />
                <label htmlFor="cart-notes" className="sr-only">Comentario para el pedido (opcional)</label>
                <textarea
                  id="cart-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={300}
                  rows={2}
                  placeholder="¿Retirás o necesitás envío? Contanos (opcional)"
                  className={inputClass}
                />
              </div>

              {canSend && whatsapp ? (
                <a
                  href={whatsappLink(whatsapp, message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-bold text-white transition-colors hover:bg-primary-hover"
                >
                  <WhatsappLogo size={22} weight="fill" aria-hidden /> Enviar pedido por WhatsApp
                </a>
              ) : (
                <p role="status" className="rounded-xl bg-warning-soft p-3 text-sm text-warning">
                  El local todavía no cargó su WhatsApp, así que no se puede enviar el pedido. Probá más tarde.
                </p>
              )}
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Precios y disponibilidad se confirman por WhatsApp.</span>
                <button type="button" onClick={cart.clear} className="cursor-pointer font-semibold underline underline-offset-2 hover:text-danger">
                  Vaciar
                </button>
              </div>
            </footer>
          </>
        )}
      </div>
    </dialog>
  );
}

export function QuantityStepper({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
}) {
  const btn =
    "grid size-8 cursor-pointer place-items-center rounded-full text-foreground hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="inline-flex items-center rounded-full border border-border-strong bg-surface" role="group" aria-label={`Cantidad de ${label}`}>
      <button type="button" className={btn} onClick={() => onChange(value - 1)} aria-label="Restar uno">
        <Minus size={14} weight="bold" aria-hidden />
      </button>
      <span className="min-w-7 text-center text-sm font-bold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= MAX_QUANTITY} aria-label="Sumar uno">
        <Plus size={14} weight="bold" aria-hidden />
      </button>
    </div>
  );
}
