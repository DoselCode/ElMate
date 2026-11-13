"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition, type ReactNode } from "react";
import { Button } from "./button";

const DEBOUNCE_MS = 350;

/**
 * Barra de filtros sin botón "Filtrar": al cambiar un combo, una casilla o escribir en el buscador
 * (con una pequeña espera entre teclas) la URL se actualiza y el listado se vuelve a cargar solo,
 * siempre desde la página 1. Los campos son comunes (`name` + `defaultValue`), así que sirve para
 * cualquier listado que lea sus filtros de la URL. Enter también busca al instante.
 */
export function AutoFilterForm({
  action,
  hasFilters,
  className = "flex flex-wrap items-end gap-3",
  children,
}: {
  /** Ruta del listado, ej: "/admin/stock". */
  action: string;
  /** Hay algún filtro aplicado: muestra "Limpiar". */
  hasFilters: boolean;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [pending, startTransition] = useTransition();

  useEffect(() => () => clearTimeout(timer.current), []);

  function go(form: HTMLFormElement) {
    clearTimeout(timer.current);
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && value.trim() !== "") params.set(key, value.trim());
    }
    const query = params.toString();
    startTransition(() => router.replace(`${action}${query ? `?${query}` : ""}`, { scroll: false }));
  }

  function clear() {
    const form = formRef.current;
    if (!form) return;
    clearTimeout(timer.current);
    for (const el of Array.from(form.elements)) {
      if (el instanceof HTMLInputElement) {
        if (el.type === "checkbox" || el.type === "radio") el.checked = false;
        else el.value = "";
      } else if (el instanceof HTMLSelectElement) {
        el.value = "";
      }
    }
    startTransition(() => router.replace(action, { scroll: false }));
  }

  return (
    <form
      ref={formRef}
      method="get"
      action={action}
      role="search"
      aria-busy={pending}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        go(e.currentTarget);
      }}
      onChange={(e) => {
        const form = e.currentTarget;
        const target = e.target;
        // Al escribir se espera un momento; combos y casillas buscan enseguida
        if (target instanceof HTMLInputElement && (target.type === "search" || target.type === "text")) {
          clearTimeout(timer.current);
          timer.current = setTimeout(() => go(form), DEBOUNCE_MS);
        } else {
          go(form);
        }
      }}
    >
      {children}
      {hasFilters && (
        <Button variant="ghost" onClick={clear}>
          Limpiar
        </Button>
      )}
      <p role="status" className="pb-2.5 text-sm text-muted">{pending ? "Actualizando…" : ""}</p>
    </form>
  );
}
