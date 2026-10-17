"use client";

import { createContext, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { addItem, cartCount, cartTotal, removeItem, sanitizeCart, setQuantity } from "@/shared/cart";
import type { CartItem } from "@/shared/types";

/**
 * Estado del carrito, guardado en el navegador del visitante (localStorage): sobrevive a recargas y
 * se sincroniza entre pestañas, pero no viaja al servidor. El pedido se envía por WhatsApp.
 */

const STORAGE_KEY = "elmate-cart-v1";
const EMPTY: CartItem[] = [];

// ---- Store externo (localStorage) ----------------------------------------------------------
let cache: CartItem[] | null = null;
const listeners = new Set<() => void>();

function readCart(): CartItem[] {
  if (cache === null) {
    try {
      cache = sanitizeCart(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]"));
    } catch {
      cache = EMPTY; // navegación privada o almacenamiento bloqueado: funciona igual, sin guardarse
    }
  }
  return cache;
}

function writeCart(update: (items: CartItem[]) => CartItem[]) {
  cache = update(readCart());
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // idem: sin almacenamiento disponible
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Otra pestaña cambió el carrito: se vuelve a leer
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

// ---- Contexto ------------------------------------------------------------------------------
type CartContextValue = {
  items: CartItem[];
  count: number;
  total: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQty: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  // En el servidor (y en la primera pintada) el carrito está vacío; después se lee del navegador
  const items = useSyncExternalStore(subscribe, readCart, () => EMPTY);
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: cartCount(items),
      total: cartTotal(items),
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      add: (item, quantity = 1) => {
        writeCart((prev) => addItem(prev, item, quantity));
        setIsOpen(true);
      },
      setQty: (variantId, quantity) => writeCart((prev) => setQuantity(prev, variantId, quantity)),
      remove: (variantId) => writeCart((prev) => removeItem(prev, variantId)),
      clear: () => writeCart(() => EMPTY),
    }),
    [items, isOpen],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart tiene que usarse dentro de <CartProvider>");
  return ctx;
}
