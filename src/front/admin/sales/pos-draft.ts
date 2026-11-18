"use client";

import { useSyncExternalStore } from "react";
import type { SellableItem } from "@/shared/types";

/**
 * Venta en curso de "Nueva venta" (carrito, descuento, forma de pago, cliente y notas), guardada en la
 * pestaña (sessionStorage). Así no se pierde al pasar a Caja, Ventas u otro módulo y volver, ni al
 * recargar. Se borra al cobrar, al vaciar el carrito o al cerrar sesión.
 */

export type DiscountType = "pct" | "amount";

/** Línea del carrito de venta. Cantidad y descuento se guardan como texto (lo que tipea quien vende). */
export type Line = { item: SellableItem; qty: string; discountType: DiscountType; discount: string; showDiscount: boolean };

export type PosDraft = {
  lines: Line[];
  discount: string;
  discountType: DiscountType;
  /** null = la forma de pago por defecto (efectivo). */
  methodId: string | null;
  customer: string;
  notes: string;
};

const STORAGE_KEY = "elmate-pos-draft-v1";

export const EMPTY_DRAFT: PosDraft = { lines: [], discount: "", discountType: "amount", methodId: null, customer: "", notes: "" };

let cache: PosDraft | null = null;
const listeners = new Set<() => void>();

function sanitize(value: unknown): PosDraft {
  if (!value || typeof value !== "object") return EMPTY_DRAFT;
  const v = value as Partial<PosDraft>;
  const str = (s: unknown) => (typeof s === "string" ? s : "");
  return {
    lines: Array.isArray(v.lines) ? v.lines.filter((l) => l && typeof l === "object" && l.item?.variant_id) : [],
    discount: str(v.discount),
    discountType: v.discountType === "pct" ? "pct" : "amount",
    methodId: typeof v.methodId === "string" ? v.methodId : null,
    customer: str(v.customer),
    notes: str(v.notes),
  };
}

function read(): PosDraft {
  if (cache === null) {
    try {
      cache = sanitize(JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "null"));
    } catch {
      cache = EMPTY_DRAFT; // almacenamiento bloqueado: funciona igual, sin recordar
    }
  }
  return cache;
}

function write(next: PosDraft) {
  cache = next;
  try {
    if (next === EMPTY_DRAFT) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // idem
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** En el servidor y en la primera pintada la venta está vacía; después se lee lo guardado. */
export function usePosDraft(): PosDraft {
  return useSyncExternalStore(subscribe, read, () => EMPTY_DRAFT);
}

export function updatePosDraft(update: (draft: PosDraft) => PosDraft) {
  write(update(read()));
}

export function clearPosDraft() {
  if (typeof window !== "undefined") write(EMPTY_DRAFT);
}
