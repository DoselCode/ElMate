"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { MagnifyingGlass, Plus, Trash } from "@phosphor-icons/react";
import { deletePromotionAction, savePromotionAction, searchPromotionVariantsAction } from "@/back/admin/promotions/actions";
import { Button, buttonClass } from "@/front/shared/ui/button";
import { Field, inputClass, TextField } from "@/front/shared/ui/field";
import { formatMoney } from "@/shared/format";
import { fieldErrors } from "@/shared/schemas/product";
import { isoToLocal, promotionSchema, type PromotionInput } from "@/shared/schemas/promotion";
import type { PromotionForEdit, PromotionVariantHit } from "@/shared/types";

type ItemDraft = { variantId: string; productName: string; variantLabel: string; sku: string; price: number; promoPrice: string };

const num = (s: string) => Number(s.replace(",", "."));

/** "Ahora" en hora argentina para el input datetime-local (se redondea a la hora). */
function nowLocal() {
  const d = new Date(Date.now() - 3 * 3_600_000);
  d.setMinutes(0, 0, 0);
  return d.toISOString().slice(0, 16);
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] bg-surface p-5 shadow-sm sm:p-6">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {description && <p className="mb-4 mt-0.5 text-sm text-muted">{description}</p>}
      {!description && <div className="mb-4" />}
      {children}
    </section>
  );
}

/** Alta y edición de una promoción: datos, fechas, productos con precio especial y card de la home. */
export function PromotionForm({ initial }: { initial?: PromotionForEdit }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [startsAt, setStartsAt] = useState(initial ? isoToLocal(initial.startsAt) : nowLocal());
  const [endsAt, setEndsAt] = useState(isoToLocal(initial?.endsAt ?? null));
  const [showCard, setShowCard] = useState(initial?.showCard ?? false);
  const [cardTitle, setCardTitle] = useState(initial?.cardTitle ?? "");
  const [cardText, setCardText] = useState(initial?.cardText ?? "");
  const [cardCta, setCardCta] = useState(initial?.cardCta ?? "");
  const [items, setItems] = useState<ItemDraft[]>(
    (initial?.items ?? []).map((i) => ({ ...i, promoPrice: String(i.promoPrice) })),
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const err = (key: string) => errors[key];

  // ---- Buscador de productos --------------------------------------------------------------
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<PromotionVariantHit[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function onSearch(value: string) {
    setSearch(value);
    clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setHits([]);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      setHits(await searchPromotionVariantsAction(value));
      setSearching(false);
    }, 300);
  }

  function addItem(hit: PromotionVariantHit) {
    setItems((prev) => (prev.some((i) => i.variantId === hit.variantId) ? prev : [...prev, { ...hit, promoPrice: "" }]));
    setSearch("");
    setHits([]);
  }

  const patchItem = (variantId: string, promoPrice: string) =>
    setItems((prev) => prev.map((i) => (i.variantId === variantId ? { ...i, promoPrice } : i)));

  // ---- Guardar ---------------------------------------------------------------------------
  function buildInput(): PromotionInput {
    return {
      id: initial?.id,
      name,
      description,
      active,
      startsAt,
      endsAt,
      showCard,
      cardTitle,
      cardText,
      cardCta,
      items: items.map((i) => ({ variantId: i.variantId, promoPrice: num(i.promoPrice) })),
    };
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    const input = buildInput();
    const checked = promotionSchema.safeParse(input);
    if (!checked.success) {
      setErrors(fieldErrors(checked.error));
      setFormError("Revisá los campos marcados en rojo.");
      queueMicrotask(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setErrors({});
    startTransition(async () => {
      const res = await savePromotionAction(input);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        return;
      }
      router.push("/admin/promociones");
      router.refresh();
    });
  }

  function remove() {
    if (!initial) return;
    if (!window.confirm(`¿Borrar la promoción “${initial.name}”? Los productos vuelven a su precio normal en la web.`)) return;
    startTransition(async () => {
      const res = await deletePromotionAction(initial.id);
      if (!res.ok) return setFormError(res.error);
      router.push("/admin/promociones");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-4xl space-y-6 pb-10">
      <header>
        <h1 className="font-display text-2xl font-bold">{initial ? "Editar promoción" : "Nueva promoción"}</h1>
        <p className="mt-1 text-sm text-muted">Las fechas son en hora de Argentina. Mientras la promo está vigente, la web muestra el precio especial y el normal tachado.</p>
      </header>

      <SectionCard title="Datos">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            id="promo-name"
            label="Nombre *"
            className="md:col-span-2"
            value={name}
            maxLength={80}
            placeholder="Ej: Cyber Monday"
            error={err("name")}
            onChange={(e) => setName(e.target.value)}
          />
          <Field label="Descripción" htmlFor="promo-description" error={err("description")} hint="Se ve arriba de la lista de productos cuando el cliente abre la promo." className="md:col-span-2">
            <textarea
              id="promo-description"
              value={description}
              maxLength={500}
              rows={2}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
          </Field>
          <TextField
            id="promo-starts"
            label="Empieza *"
            type="datetime-local"
            value={startsAt}
            error={err("startsAt")}
            onChange={(e) => setStartsAt(e.target.value)}
          />
          <TextField
            id="promo-ends"
            label="Termina"
            type="datetime-local"
            value={endsAt}
            hint="Vacío = sin fecha de fin."
            error={err("endsAt")}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="mt-1 size-4 accent-primary" />
          <span>
            <span className="block text-sm font-semibold">Activa</span>
            <span className="block text-xs text-muted">Si la destildás, la promo se pausa aunque esté dentro de las fechas.</span>
          </span>
        </label>
      </SectionCard>

      <SectionCard
        title="Productos y precios especiales"
        description="Buscá un producto por nombre o código y poné el precio promocional. Tiene que ser menor al de lista. No cambia el precio del punto de venta."
      >
        <div className="relative">
          <label htmlFor="promo-search" className="sr-only">Buscar producto</label>
          <MagnifyingGlass size={18} className="pointer-events-none absolute left-3.5 top-3 text-muted" aria-hidden />
          <input
            id="promo-search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Buscar producto para sumar…"
            autoComplete="off"
            className={`${inputClass} pl-10`}
          />
          {(hits.length > 0 || (searching && search.trim().length >= 2)) && (
            <ul className="absolute z-10 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-border-strong bg-surface shadow-lg">
              {searching && hits.length === 0 && <li className="px-4 py-3 text-sm text-muted">Buscando…</li>}
              {hits.map((h) => {
                const added = items.some((i) => i.variantId === h.variantId);
                return (
                  <li key={h.variantId}>
                    <button
                      type="button"
                      disabled={added}
                      onClick={() => addItem(h)}
                      className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{h.productName}</span>
                        <span className="block truncate text-xs text-muted">
                          {[h.variantLabel, h.sku].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 tabular-nums">
                        {formatMoney(h.price)}
                        {added ? <span className="text-xs text-muted">Ya está</span> : <Plus size={16} weight="bold" aria-hidden />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {err("items") && (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">{err("items")}</p>
        )}

        {items.length === 0 ? (
          <p className="mt-4 rounded-xl bg-background p-4 text-sm text-muted">Todavía no sumaste productos.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {items.map((item, i) => {
              const promo = num(item.promoPrice);
              const pct = item.promoPrice && promo > 0 && promo < item.price ? Math.round(100 * (1 - promo / item.price)) : null;
              return (
                <li key={item.variantId} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.productName}</p>
                    <p className="truncate text-xs text-muted">
                      {[item.variantLabel, item.sku].filter(Boolean).join(" · ")} · Lista {formatMoney(item.price)}
                    </p>
                  </div>
                  <div className="w-36">
                    <label htmlFor={`promo-price-${i}`} className="sr-only">Precio promocional de {item.productName}</label>
                    <input
                      id={`promo-price-${i}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={item.promoPrice}
                      placeholder="Precio promo"
                      aria-invalid={Boolean(err(`items.${i}.promoPrice`))}
                      onChange={(e) => patchItem(item.variantId, e.target.value)}
                      className={`${inputClass} ${err(`items.${i}.promoPrice`) ? "border-danger" : ""}`}
                    />
                    {err(`items.${i}.promoPrice`) && <p role="alert" className="mt-1 text-xs font-medium text-danger">{err(`items.${i}.promoPrice`)}</p>}
                  </div>
                  <span className="w-14 text-right text-sm font-bold tabular-nums text-primary">{pct !== null ? `-${pct}%` : ""}</span>
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((x) => x.variantId !== item.variantId))}
                    aria-label={`Quitar ${item.productName}`}
                    className="grid size-8 cursor-pointer place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash size={16} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Card en la home"
        description="Una tarjeta destacada en la portada de la web mientras la promo esté vigente (ideal para fechas especiales). Lleva a la lista de sus productos."
      >
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={showCard} onChange={(e) => setShowCard(e.target.checked)} className="mt-1 size-4 accent-primary" />
          <span>
            <span className="block text-sm font-semibold">Mostrar card en la home</span>
            <span className="block text-xs text-muted">Sin título o texto propios usa el nombre y la descripción de la promo.</span>
          </span>
        </label>
        {showCard && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextField id="card-title" label="Título de la card" className="md:col-span-2" value={cardTitle} maxLength={80} placeholder={name || "Ej: Cyber Monday: hasta 30% off"} error={err("cardTitle")} onChange={(e) => setCardTitle(e.target.value)} />
            <TextField id="card-text" label="Texto" className="md:col-span-2" value={cardText} maxLength={200} placeholder="Ej: Solo hasta el lunes, mates y termos con precio especial." error={err("cardText")} onChange={(e) => setCardText(e.target.value)} />
            <TextField id="card-cta" label="Texto del botón" value={cardCta} maxLength={30} placeholder="Ver promo" error={err("cardCta")} onChange={(e) => setCardCta(e.target.value)} />
          </div>
        )}
      </SectionCard>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {initial && (
            <Button variant="ghost" onClick={remove} disabled={pending} className="text-danger">
              <Trash size={16} aria-hidden /> Borrar promoción
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {formError && <p role="alert" className="text-sm font-semibold text-danger">{formError}</p>}
          <Link href="/admin/promociones" className={buttonClass("secondary")}>Cancelar</Link>
          <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar promoción"}</Button>
        </div>
      </div>
    </form>
  );
}
