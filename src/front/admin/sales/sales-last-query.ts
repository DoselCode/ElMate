"use client";

import { useSyncExternalStore } from "react";

/**
 * Últimos filtros usados en el historial de ventas ("?from=...&to=..."), guardados en la pestaña
 * (sessionStorage). El link "Ventas" del menú los usa para volver a la misma lista después de ver un
 * ticket o pasar por otro módulo. "" = la vista por defecto (ventas de hoy).
 */

const STORAGE_KEY = "elmate-sales-query-v1";
const listeners = new Set<() => void>();
let cache: string | null = null;

function read(): string {
  if (cache === null) {
    try {
      const saved = window.sessionStorage.getItem(STORAGE_KEY) ?? "";
      cache = saved.startsWith("?") ? saved : "";
    } catch {
      cache = ""; // almacenamiento bloqueado: el menú lleva a las ventas de hoy
    }
  }
  return cache;
}

export function saveSalesQuery(query: string) {
  if (read() === query) return;
  cache = query;
  try {
    if (query) window.sessionStorage.setItem(STORAGE_KEY, query);
    else window.sessionStorage.removeItem(STORAGE_KEY);
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

/** En el servidor y en la primera pintada no hay filtros guardados; después se leen de la pestaña. */
export function useSalesQuery(): string {
  return useSyncExternalStore(subscribe, read, () => "");
}
