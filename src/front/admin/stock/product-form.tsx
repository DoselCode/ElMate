"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash, X } from "@phosphor-icons/react";
import { archiveProductAction, saveProductAction } from "@/back/admin/stock/actions";
import { Button, buttonClass } from "@/front/shared/ui/button";
import { Field, inputClass, TextField } from "@/front/shared/ui/field";
import { Modal } from "@/front/shared/ui/modal";
import { fieldErrors, productSchema, type ProductInput } from "@/shared/schemas/product";
import type { Option, ProductForEdit, VariantForEdit } from "@/shared/types";
import { ImageUploader } from "./image-uploader";

/** Estado de una variante mientras se edita: los números se guardan como texto (lo que tipea el usuario). */
type VariantDraft = {
  key: string;
  id?: string;
  sku: string;
  barcode: string;
  attributes: Record<string, string>;
  price: string;
  cost: string;
  minStock: string;
  initialStock: string;
  active: boolean;
  /** Solo variantes existentes: el stock se mueve desde Inventario, no desde acá. */
  currentStock?: number;
};

const OPTION_SUGGESTIONS = ["Color", "Tamaño", "Material", "Talle"];

const num = (s: string) => (s.trim() === "" ? Number.NaN : Number(s));
const newKey = () => crypto.randomUUID();
const omit = (obj: Record<string, string>, key: string) => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));

function emptyVariant(from?: VariantDraft): VariantDraft {
  return {
    key: newKey(),
    sku: "",
    barcode: "",
    attributes: {},
    price: from?.price ?? "",
    cost: from?.cost ?? "",
    minStock: from?.minStock ?? "0",
    initialStock: "0",
    active: true,
  };
}

function toDraft(v: VariantForEdit): VariantDraft {
  return {
    key: v.id,
    id: v.id,
    sku: v.sku,
    barcode: v.barcode ?? "",
    attributes: v.attributes,
    price: String(v.price),
    cost: String(v.cost),
    minStock: String(v.minStock),
    initialStock: "0",
    active: v.active,
    currentStock: v.stock,
  };
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] bg-surface p-6 shadow-sm">
      <h2 className="font-serif text-lg font-bold">{title}</h2>
      {description && <p className="mb-4 mt-0.5 text-sm text-muted">{description}</p>}
      {!description && <div className="mb-4" />}
      {children}
    </section>
  );
}

export function ProductForm({
  initial,
  categories,
  suppliers,
}: {
  initial?: ProductForEdit;
  categories: Option[];
  suppliers: Option[];
}) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? "");
  const [badge, setBadge] = useState(initial?.badge ?? "");
  const [isVisible, setIsVisible] = useState(initial?.isVisible ?? true);
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [optionNames, setOptionNames] = useState<string[]>(initial?.optionNames ?? []);
  const [optionDraft, setOptionDraft] = useState("");
  const [variants, setVariants] = useState<VariantDraft[]>(
    initial?.variants.length ? initial.variants.map(toDraft) : [emptyVariant()],
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, startArchive] = useTransition();

  const hasOptions = optionNames.length > 0;

  // ---- opciones (ejes de variación) -------------------------------------------------------
  function addOption(raw: string) {
    const value = raw.trim();
    if (!value) return;
    if (optionNames.some((o) => o.toLowerCase() === value.toLowerCase())) {
      setErrors((e) => ({ ...e, optionNames: `"${value}" ya está agregada` }));
      return;
    }
    if (optionNames.length >= 3) {
      setErrors((e) => ({ ...e, optionNames: "Máximo 3 opciones" }));
      return;
    }
    setErrors((e) => omit(e, "optionNames"));
    setOptionNames([...optionNames, value]);
    setOptionDraft("");
  }

  function removeOption(option: string) {
    setOptionNames(optionNames.filter((o) => o !== option));
    setVariants((vs) => vs.map((v) => ({ ...v, attributes: omit(v.attributes, option) })));
  }

  // ---- variantes --------------------------------------------------------------------------
  const patchVariant = (key: string, patch: Partial<VariantDraft>) =>
    setVariants((vs) => vs.map((v) => (v.key === key ? { ...v, ...patch } : v)));

  const setAttribute = (key: string, option: string, value: string) =>
    setVariants((vs) => vs.map((v) => (v.key === key ? { ...v, attributes: { ...v.attributes, [option]: value } } : v)));

  // ---- guardar ----------------------------------------------------------------------------
  function buildInput(): ProductInput {
    return {
      id: initial?.id,
      name,
      description,
      categoryId: categoryId || null,
      supplierId: supplierId || null,
      optionNames,
      images,
      isVisible,
      badge,
      variants: variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        barcode: v.barcode,
        attributes: v.attributes,
        price: num(v.price),
        cost: v.cost.trim() === "" ? 0 : num(v.cost),
        minStock: v.minStock.trim() === "" ? 0 : num(v.minStock),
        initialStock: v.initialStock.trim() === "" ? 0 : num(v.initialStock),
        active: v.active,
      })),
    };
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(undefined);

    const input = buildInput();
    const checked = productSchema.safeParse(input);
    if (!checked.success) {
      setErrors(fieldErrors(checked.error));
      setFormError("Revisá los campos marcados en rojo.");
      // Lleva el foco al primer error para que se vea (y lo anuncie el lector de pantalla)
      queueMicrotask(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setErrors({});

    startTransition(async () => {
      const res = await saveProductAction(input);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        return;
      }
      router.push("/admin/stock?saved=1");
    });
  }

  function archive() {
    if (!initial) return;
    startArchive(async () => {
      const res = await archiveProductAction(initial.id);
      if (!res.ok) {
        setConfirmArchive(false);
        setFormError(res.error);
        return;
      }
      router.push("/admin/stock");
    });
  }

  const err = (key: string) => errors[key];
  const busy = pending || archiving;

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-4xl space-y-6 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-bold">{isEdit ? "Editar producto" : "Nuevo producto"}</h1>
        <Link href="/admin/stock" className={buttonClass("ghost")}>
          Volver al inventario
        </Link>
      </header>

      {formError && (
        <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {formError}
        </p>
      )}

      <SectionCard title="Información básica">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            id="name"
            label="Nombre *"
            className="md:col-span-2"
            value={name}
            maxLength={150}
            placeholder="Ej: Mate Imperial"
            error={err("name")}
            onChange={(e) => setName(e.target.value)}
          />
          <Field label="Categoría" htmlFor="category">
            <select id="category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Proveedor" htmlFor="supplier">
            <select id="supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputClass}>
              <option value="">Sin proveedor</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Descripción" htmlFor="description" error={err("description")} className="md:col-span-2">
            <textarea
              id="description"
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
              placeholder="Materiales, medidas, cuidados…"
            />
          </Field>
          <TextField
            id="badge"
            label="Etiqueta (opcional)"
            value={badge}
            maxLength={50}
            placeholder="Ej: Novedad, Más vendido"
            error={err("badge")}
            onChange={(e) => setBadge(e.target.value)}
          />
          <label className="flex items-center gap-2.5 self-end pb-2.5 text-sm font-medium">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => setIsVisible(e.target.checked)}
              className="size-4 accent-primary"
            />
            Visible en la tienda web
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Fotos">
        <ImageUploader images={images} onChange={setImages} error={err("images")} />
      </SectionCard>

      <SectionCard
        title="Opciones y variantes"
        description="Si el producto viene en varios colores, tamaños o materiales, definí las opciones y cargá una variante por combinación. Cada variante tiene su propio código, precio y stock."
      >
        <div className="mb-5">
          <p id="options-label" className="mb-1.5 text-sm font-medium">Opciones</p>
          {hasOptions && (
            <ul aria-labelledby="options-label" className="mb-2 flex flex-wrap gap-2">
              {optionNames.map((o) => (
                <li key={o} className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-1 pl-3.5 pr-1.5 text-sm font-semibold">
                  {o}
                  <button
                    type="button"
                    onClick={() => removeOption(o)}
                    aria-label={`Quitar la opción ${o}`}
                    className="grid size-6 cursor-pointer place-items-center rounded-full hover:bg-primary/15"
                  >
                    <X size={12} weight="bold" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {optionNames.length < 3 && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="option-draft"
                value={optionDraft}
                maxLength={30}
                aria-labelledby="options-label"
                aria-invalid={Boolean(err("optionNames"))}
                aria-describedby={err("optionNames") ? "option-draft-error" : undefined}
                onChange={(e) => setOptionDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault(); // Enter no debe enviar el formulario
                    addOption(optionDraft);
                  }
                }}
                placeholder="Ej: Color"
                className={`${inputClass} max-w-48`}
              />
              <Button variant="secondary" size="sm" onClick={() => addOption(optionDraft)}>
                Agregar opción
              </Button>
              {!hasOptions &&
                OPTION_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addOption(s)}
                    className="cursor-pointer rounded-full border border-dashed border-border-strong px-3 py-1 text-xs font-medium text-muted hover:border-primary hover:text-primary"
                  >
                    + {s}
                  </button>
                ))}
            </div>
          )}
          {err("optionNames") && (
            <p id="option-draft-error" role="alert" className="mt-1 text-xs font-medium text-danger">
              {err("optionNames")}
            </p>
          )}
          {!hasOptions && (
            <p className="mt-2 text-xs text-muted">Sin opciones, el producto tiene una única variante.</p>
          )}
        </div>

        {err("variants") && (
          <p role="alert" className="mb-3 text-sm font-medium text-danger">
            {err("variants")}
          </p>
        )}

        <ul className="space-y-4">
          {variants.map((v, i) => {
            const label = optionNames.map((o) => v.attributes[o]?.trim()).filter(Boolean).join(" / ");
            const p = `variants.${i}`;
            const idp = `v-${v.key}`;
            return (
              <li key={v.key} className="rounded-2xl border border-border bg-background/60 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold">
                    {hasOptions ? `Variante ${i + 1}${label ? ` · ${label}` : ""}` : "Datos de venta"}
                  </h3>
                  {variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setVariants((vs) => vs.filter((x) => x.key !== v.key))}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger-soft"
                      aria-label={`Quitar la variante ${i + 1}`}
                    >
                      <Trash size={14} aria-hidden /> Quitar
                    </button>
                  )}
                </div>

                {hasOptions && (
                  <div className="mb-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {optionNames.map((o) => (
                      <TextField
                        key={o}
                        id={`${idp}-attr-${o}`}
                        label={`${o} *`}
                        value={v.attributes[o] ?? ""}
                        maxLength={60}
                        error={err(`${p}.attributes.${o}`) ?? (o === optionNames[0] ? err(`${p}.attributes`) : undefined)}
                        onChange={(e) => setAttribute(v.key, o, e.target.value)}
                      />
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <TextField
                    id={`${idp}-sku`}
                    label="Código (SKU)"
                    value={v.sku}
                    maxLength={40}
                    placeholder="Automático"
                    error={err(`${p}.sku`)}
                    onChange={(e) => patchVariant(v.key, { sku: e.target.value })}
                  />
                  <TextField
                    id={`${idp}-barcode`}
                    label="Código de barras"
                    value={v.barcode}
                    maxLength={64}
                    inputMode="numeric"
                    error={err(`${p}.barcode`)}
                    onChange={(e) => patchVariant(v.key, { barcode: e.target.value })}
                  />
                  <TextField
                    id={`${idp}-price`}
                    label="Precio de venta *"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={v.price}
                    error={err(`${p}.price`)}
                    onChange={(e) => patchVariant(v.key, { price: e.target.value })}
                  />
                  <TextField
                    id={`${idp}-cost`}
                    label="Costo"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={v.cost}
                    error={err(`${p}.cost`)}
                    onChange={(e) => patchVariant(v.key, { cost: e.target.value })}
                  />
                  <TextField
                    id={`${idp}-min`}
                    label="Stock mínimo"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={v.minStock}
                    hint="Avisa cuando baja de este número"
                    error={err(`${p}.minStock`)}
                    onChange={(e) => patchVariant(v.key, { minStock: e.target.value })}
                  />
                  {v.id ? (
                    <div>
                      <p className="mb-1.5 text-sm font-medium">Stock actual</p>
                      <p className="py-2.5 text-sm font-semibold tabular-nums">{v.currentStock}</p>
                      <p className="text-xs text-muted">Se modifica con Ingreso o Ajuste en el inventario</p>
                    </div>
                  ) : (
                    <TextField
                      id={`${idp}-initial`}
                      label="Stock inicial"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      value={v.initialStock}
                      error={err(`${p}.initialStock`)}
                      onChange={(e) => patchVariant(v.key, { initialStock: e.target.value })}
                    />
                  )}
                  <label className="col-span-2 flex items-center gap-2.5 self-end pb-2.5 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={v.active}
                      onChange={(e) => patchVariant(v.key, { active: e.target.checked })}
                      className="size-4 accent-primary"
                    />
                    Activa (se puede vender)
                  </label>
                </div>
              </li>
            );
          })}
        </ul>

        {hasOptions && variants.length < 100 && (
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => setVariants((vs) => [...vs, emptyVariant(vs[vs.length - 1])])}
          >
            <Plus size={16} weight="bold" aria-hidden /> Agregar variante
          </Button>
        )}
        {isEdit && (
          <p className="mt-3 text-xs text-muted">
            Las variantes que quites se desactivan: dejan de venderse pero conservan su historial.
          </p>
        )}
      </SectionCard>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {isEdit && (
            <Button variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setConfirmArchive(true)} disabled={busy}>
              Archivar producto
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Link href="/admin/stock" className={buttonClass("secondary")}>
            Cancelar
          </Link>
          <Button type="submit" disabled={busy}>
            {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear producto"}
          </Button>
        </div>
      </div>

      <Modal open={confirmArchive} onClose={() => setConfirmArchive(false)} title="¿Archivar este producto?">
        <p className="text-sm text-muted">
          Deja de aparecer en el inventario y en la tienda web. El historial de ventas y movimientos se conserva.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmArchive(false)} disabled={archiving}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={archive} disabled={archiving}>
            {archiving ? "Archivando…" : "Archivar"}
          </Button>
        </div>
      </Modal>
    </form>
  );
}
