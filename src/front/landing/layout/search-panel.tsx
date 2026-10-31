"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, CircleNotch, MagnifyingGlass, X } from "@phosphor-icons/react";
import { formatMoney } from "@/shared/format";
import type { SearchResult } from "@/shared/types";
import { ProductImage } from "../catalog/product-image";

type State =
  | { status: "idle" }
  | { status: "loading"; query: string }
  | { status: "done"; query: string; rows: SearchResult[]; total: number }
  | { status: "error"; query: string };

const MIN_CHARS = 2;
const DEBOUNCE_MS = 180;

const tiendaHref = (q: string) => `/tienda?q=${encodeURIComponent(q.trim())}`;

/**
 * Buscador flotante del header: muestra resultados mientras se escribe (sin recargar la página).
 * Enter abre el resultado marcado o la tienda filtrada; flechas para moverse; Escape cierra.
 */
export function SearchPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const [active, setActive] = useState(-1);

  useEffect(() => inputRef.current?.focus(), []);

  // Búsqueda con espera corta entre teclas; la respuesta vieja se descarta si se sigue escribiendo
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_CHARS) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/buscar?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { rows: SearchResult[]; total: number };
        setState({ status: "done", query: q, rows: data.rows, total: data.total });
        setActive(-1);
      } catch {
        if (!controller.signal.aborted) setState({ status: "error", query: q });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Clic afuera o Escape: cerrar
  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (!panelRef.current?.contains(target) && !target.closest("[data-search-toggle]")) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function change(value: string) {
    setQuery(value);
    setState(value.trim().length < MIN_CHARS ? { status: "idle" } : { status: "loading", query: value.trim() });
  }

  const rows = state.status === "done" ? state.rows : [];

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && rows.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % rows.length);
    } else if (e.key === "ArrowUp" && rows.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? rows.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const picked = rows[active];
      if (picked) router.push(`/producto/${picked.slug}`);
      else if (query.trim().length >= MIN_CHARS) router.push(tiendaHref(query));
      else return;
      onClose();
    }
  }

  return (
    <div
      ref={panelRef}
      role="search"
      className="search-pop absolute inset-x-0 top-full mt-3 overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-[0_24px_60px_rgb(16_21_28/0.16)] sm:left-auto sm:w-[30rem]"
    >
      <div className="flex items-center gap-3 px-5 py-4">
        {state.status === "loading" ? (
          <CircleNotch size={20} className="shrink-0 animate-spin text-primary" aria-hidden />
        ) : (
          <MagnifyingGlass size={20} className="shrink-0 text-muted" aria-hidden />
        )}
        <label htmlFor={`${listId}-q`} className="sr-only">Buscar productos</label>
        <input
          ref={inputRef}
          id={`${listId}-q`}
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(e) => change(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Buscá mates, termos, yerbas…"
          role="combobox"
          aria-expanded={rows.length > 0}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          className="min-w-0 flex-1 bg-transparent text-base outline-none focus-visible:outline-none placeholder:text-muted/70 [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar el buscador"
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-muted hover:bg-primary-soft hover:text-foreground"
        >
          <X size={16} weight="bold" aria-hidden />
        </button>
      </div>

      <div className="border-t border-border/70">
        {state.status === "idle" && (
          <p className="px-5 py-4 text-sm text-muted">Escribí al menos {MIN_CHARS} letras: por ejemplo “imperial” o “canarias”.</p>
        )}
        {state.status === "error" && (
          <p role="alert" className="px-5 py-4 text-sm text-danger">No se pudo buscar. Probá de nuevo.</p>
        )}
        {state.status === "done" && rows.length === 0 && (
          <p className="px-5 py-4 text-sm text-muted">No encontramos productos con “{state.query}”.</p>
        )}

        {rows.length > 0 && (
          <ul id={listId} role="listbox" aria-label="Resultados" className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
            {rows.map((r, i) => (
              <li key={r.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                <Link
                  href={`/producto/${r.slug}`}
                  onClick={onClose}
                  onMouseEnter={() => setActive(i)}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2 transition-colors ${i === active ? "bg-primary-soft" : "hover:bg-primary-soft/60"}`}
                >
                  <ProductImage src={r.image} alt="" sizes="48px" className="size-12 shrink-0 rounded-xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      <Highlight text={r.name} query={state.status === "done" ? state.query : ""} />
                    </span>
                    {r.category_name && <span className="block text-xs text-muted">{r.category_name}</span>}
                  </span>
                  <span className="shrink-0 text-right text-sm font-bold tabular-nums">
                    {r.has_price_range && <span className="mr-1 text-xs font-medium text-muted">Desde</span>}
                    {formatMoney(r.price)}
                    {r.unit === "kg" && <span className="text-xs font-medium text-muted">/kg</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {state.status === "done" && state.total > 0 && (
          <Link
            href={tiendaHref(state.query)}
            onClick={onClose}
            className="flex items-center justify-between border-t border-border/70 px-5 py-3 text-sm font-bold text-primary hover:bg-primary-soft/60"
          >
            {state.total > rows.length ? `Ver los ${state.total} resultados` : "Ver en la tienda"}
            <ArrowRight size={16} weight="bold" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}

/** Resalta en el nombre las palabras buscadas. */
function Highlight({ text, query }: { text: string; query: string }) {
  const words = query.split(/\s+/).filter((w) => w.length >= 2).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${words.join("|")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-transparent text-primary">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
