"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Calculator, PencilSimple, Plus, Trash, X } from "@phosphor-icons/react";
import { archiveProductAction, saveProductAction } from "@/back/admin/stock/actions";
import { Button, buttonClass } from "@/front/shared/ui/button";
import { Field, inputClass, TextField } from "@/front/shared/ui/field";
import { Modal } from "@/front/shared/ui/modal";
import { formatMoney, formatQuantity, parseDecimal, type Unit } from "@/shared/format";
import { applyAdjustment, priceFromCost } from "@/shared/pricing";
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
  /** Precio anterior (tachado en la web). Vacío = sin oferta. */
  compareAt: string;
  cost: string;
  /** % de ganancia sobre el precio en efectivo. */
  margin: string;
  /** true = el precio se escribe a mano; false = se calcula con costo + ganancia. */
  manualPrice: boolean;
  minStock: string;
  initialStock: string;
  active: boolean;
  /** Solo variantes existentes: el stock se mueve desde Inventario, no desde acá. */
  currentStock?: number;
};

const OPTION_SUGGESTIONS = ["Color", "Tamaño", "Material", "Talle"];

const num = (s: string) => (s.trim() === "" ? Number.NaN : parseDecimal(s));
const newKey = () => crypto.randomUUID();
const omit = (obj: Record<string, string>, key: string) => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));

function emptyVariant(from?: VariantDraft): VariantDraft {
  return {
    key: newKey(),
    sku: "",
    barcode: "",
    attributes: {},
    price: from?.price ?? "",
    compareAt: from?.compareAt ?? "",
    cost: from?.cost ?? "",
    margin: from?.margin ?? "",
    manualPrice: from?.manualPrice ?? false,
    minStock: from?.minStock ?? "0",
    initialStock: "0",
    active: true,
  };
}

function toDraft(v: VariantForEdit, cashAdjustmentPct: number): VariantDraft {
  // Si el precio guardado coincide con el calculado, se sigue calculando solo; si no, quedó puesto a mano
  const auto = v.marginPct === null ? null : priceFromCost(v.cost, v.marginPct, cashAdjustmentPct);
  return {
    key: v.id,
    id: v.id,
    sku: v.sku,
    barcode: v.barcode ?? "",
    attributes: v.attributes,
    price: String(v.price),
    compareAt: v.compareAtPrice === null ? "" : String(v.compareAtPrice),
    cost: String(v.cost),
    margin: v.marginPct === null ? "" : String(v.marginPct),
    manualPrice: auto === null || Math.abs(auto.listPrice - v.price) > 0.009,
    minStock: String(v.minStock),
    initialStock: "0",
    active: v.active,
    currentStock: v.stock,
  };
}

function SectionCard({
  title,
  description,
  className = "",
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-[var(--radius-card)] bg-surface p-5 shadow-sm sm:p-6 ${className}`}>
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {description && <p className="mb-4 mt-0.5 text-sm text-muted">{description}</p>}
      {!description && <div className="mb-4" />}
      {children}
    </section>
  );
}

/** Interruptor de las opciones de la web: título, explicación y checkbox. */
function WebOption({
  checked,
  onChange,
  title,
  hint,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked && !disabled}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-4 accent-primary"
      />
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </label>
  );
}

/** Precio de lista calculado con costo + ganancia, o null si falta algún dato. */
function autoPrice(v: VariantDraft, cashAdjustmentPct: number) {
  return v.manualPrice ? null : priceFromCost(num(v.cost), num(v.margin), cashAdjustmentPct);
}

export function ProductForm({
  initial,
  categories,
  suppliers,
  cashAdjustmentPct,
}: {
  initial?: ProductForEdit;
  categories: Option[];
  suppliers: Option[];
  /** Ajuste de la forma de pago en efectivo (ej: −20): la ganancia se calcula sobre ese precio. */
  cashAdjustmentPct: number;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [unit, setUnit] = useState<Unit>(initial?.unit ?? "unidad");
  const [trackStock, setTrackStock] = useState(initial?.trackStock ?? true);
  const [badge, setBadge] = useState(initial?.badge ?? "");
  const [isVisible, setIsVisible] = useState(initial?.isVisible ?? true);
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false);
  const [showInNews, setShowInNews] = useState(initial?.showInNews ?? true);
  const [webOrder, setWebOrder] = useState(initial?.webOrder === null || initial?.webOrder === undefined ? "" : String(initial.webOrder));
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [optionNames, setOptionNames] = useState<string[]>(initial?.optionNames ?? []);
  const [optionDraft, setOptionDraft] = useState("");
  const [variants, setVariants] = useState<VariantDraft[]>(
    initial?.variants.length ? initial.variants.map((v) => toDraft(v, cashAdjustmentPct)) : [emptyVariant()],
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
      brand,
      unit,
      trackStock,
      optionNames,
      images,
      isVisible,
      badge,
      isFeatured,
      showInNews,
      webOrder: webOrder.trim() === "" ? null : num(webOrder),
      variants: variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        barcode: v.barcode,
        attributes: v.attributes,
        price: autoPrice(v, cashAdjustmentPct)?.listPrice ?? num(v.price),
        compareAtPrice: v.compareAt.trim() === "" ? null : num(v.compareAt),
        cost: v.cost.trim() === "" ? 0 : num(v.cost),
        marginPct: v.margin.trim() === "" ? null : num(v.margin),
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
    <form onSubmit={submit} noValidate className="space-y-6 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{isEdit ? "Editar producto" : "Nuevo producto"}</h1>
        <Link href="/admin/stock" className={buttonClass("ghost")}>
          Volver al inventario
        </Link>
      </header>

      {formError && (
        <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {formError}
        </p>
      )}

      {/* Una columna en celular y tablet; desde pantallas grandes, datos y variantes a la izquierda y fotos fijas a la derecha */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]">
      <SectionCard title="Información básica" className="xl:col-start-1">
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          <TextField
            id="name"
            label="Nombre *"
            className="md:col-span-2 2xl:col-span-3"
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
          <TextField
            id="brand"
            label="Marca"
            value={brand}
            maxLength={80}
            placeholder="Ej: Canarias, Waterdog"
            error={err("brand")}
            onChange={(e) => setBrand(e.target.value)}
          />
          <Field label="Se vende por" htmlFor="unit" hint={unit === "kg" ? "Cantidades con decimales: 0,25 kg" : undefined}>
            <select id="unit" value={unit} onChange={(e) => setUnit(e.target.value as Unit)} className={inputClass}>
              <option value="unidad">Unidad</option>
              <option value="kg">Kilo (a granel)</option>
            </select>
          </Field>
          <label className="flex items-start gap-2.5 text-sm font-medium md:col-span-2 2xl:col-span-3">
            <input
              type="checkbox"
              checked={trackStock}
              onChange={(e) => setTrackStock(e.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              Lleva control de stock
              <span className="block text-xs font-normal text-muted">
                Destildalo para servicios como los grabados: se venden sin descontar inventario.
              </span>
            </span>
          </label>
          <Field label="Descripción" htmlFor="description" error={err("description")} className="md:col-span-2 2xl:col-span-3">
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
        </div>
      </SectionCard>

      {/* Columna derecha (pantallas grandes): fotos y cómo se muestra el producto en la web */}
      <div className="space-y-6 xl:sticky xl:top-6 xl:col-start-2 xl:row-span-2 xl:row-start-1">
        <SectionCard title="Fotos">
          <ImageUploader images={images} onChange={setImages} error={err("images")} />
        </SectionCard>

        <SectionCard
          title="En la web"
          description="Elegí cómo y dónde aparece este producto en la tienda y en la home."
        >
          <div className="space-y-4">
            <WebOption
              checked={isVisible}
              onChange={setIsVisible}
              title="Visible en la tienda"
              hint="Si lo destildás, el producto se oculta de la web pero sigue en el inventario."
            />
            <WebOption
              checked={isFeatured}
              onChange={setIsFeatured}
              disabled={!isVisible}
              title="Destacado en la home"
              hint="Aparece en la sección “Productos destacados” y primero en la tienda. Podés marcar todos los que quieras."
            />
            <WebOption
              checked={showInNews}
              onChange={setShowInNews}
              disabled={!isVisible}
              title="Mostrar en Novedades"
              hint="Si lo destildás, no sale en la sección de novedades aunque sea de los últimos que cargaste."
            />
            <TextField
              id="badge"
              label="Etiqueta sobre la foto"
              value={badge}
              maxLength={50}
              placeholder="Ej: Novedad, Más vendido"
              hint="Un cartelito corto que se ve sobre la imagen del producto."
              error={err("badge")}
              onChange={(e) => setBadge(e.target.value)}
            />
            <TextField
              id="web-order"
              label="Orden en la web"
              type="number"
              inputMode="numeric"
              min={0}
              max={9999}
              step={1}
              value={webOrder}
              placeholder="Automático"
              hint="Número chico = aparece antes (entre los destacados y en la tienda). Vacío = al final."
              error={err("webOrder")}
              onChange={(e) => setWebOrder(e.target.value)}
            />
          </div>
        </SectionCard>
      </div>

      <SectionCard
        className="xl:col-start-1"
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

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-6">
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
                    id={`${idp}-cost`}
                    label={unit === "kg" ? "Costo por kg" : "Costo"}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={v.cost}
                    error={err(`${p}.cost`)}
                    onChange={(e) => patchVariant(v.key, { cost: e.target.value })}
                  />
                  <TextField
                    id={`${idp}-margin`}
                    label="Ganancia %"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={99.99}
                    step="0.01"
                    value={v.margin}
                    placeholder="Ej: 50"
                    hint="Sobre el precio en efectivo"
                    error={err(`${p}.marginPct`)}
                    onChange={(e) => patchVariant(v.key, { margin: e.target.value })}
                  />
                  <PriceField
                    idp={idp}
                    draft={v}
                    unit={unit}
                    cashAdjustmentPct={cashAdjustmentPct}
                    error={err(`${p}.price`)}
                    onChange={(patch) => patchVariant(v.key, patch)}
                  />
                  <TextField
                    id={`${idp}-compare`}
                    label="Precio anterior"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={v.compareAt}
                    hint="Opcional: se muestra tachado como oferta"
                    error={err(`${p}.compareAtPrice`)}
                    onChange={(e) => patchVariant(v.key, { compareAt: e.target.value })}
                  />
                  {trackStock && (
                    <TextField
                      id={`${idp}-min`}
                      label={unit === "kg" ? "Stock mínimo (kg)" : "Stock mínimo"}
                      inputMode="decimal"
                      value={v.minStock}
                      hint="Avisa cuando baja de este número"
                      error={err(`${p}.minStock`)}
                      onChange={(e) => patchVariant(v.key, { minStock: e.target.value })}
                    />
                  )}
                  {trackStock &&
                    (v.id ? (
                      <div>
                        <p className="mb-1.5 text-sm font-medium">Stock actual</p>
                        <p className="py-2.5 text-sm font-semibold tabular-nums">
                          {v.currentStock !== undefined ? formatQuantity(v.currentStock, unit) : "—"}
                        </p>
                        <p className="text-xs text-muted">Se modifica con Ingreso o Ajuste en el inventario</p>
                      </div>
                    ) : (
                      <TextField
                        id={`${idp}-initial`}
                        label={unit === "kg" ? "Stock inicial (kg)" : "Stock inicial"}
                        inputMode="decimal"
                        value={v.initialStock}
                        error={err(`${p}.initialStock`)}
                        onChange={(e) => patchVariant(v.key, { initialStock: e.target.value })}
                      />
                    ))}
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
      </div>

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

/**
 * Precio de lista: se calcula solo con costo + ganancia (como la lista del local) o se escribe a mano.
 * Debajo muestra cuánto sale en efectivo.
 */
function PriceField({
  idp,
  draft,
  unit,
  cashAdjustmentPct,
  error,
  onChange,
}: {
  idp: string;
  draft: VariantDraft;
  unit: Unit;
  cashAdjustmentPct: number;
  error?: string;
  onChange: (patch: Partial<VariantDraft>) => void;
}) {
  const auto = autoPrice(draft, cashAdjustmentPct);
  const list = auto?.listPrice ?? num(draft.price);
  const cash = Number.isFinite(list) ? (auto?.cashPrice ?? applyAdjustment(list, cashAdjustmentPct)) : null;
  const label = unit === "kg" ? "Precio de lista por kg *" : "Precio de lista *";
  const toggle =
    "mt-1 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary hover:underline underline-offset-2";

  if (!draft.manualPrice) {
    return (
      <div>
        <p id={`${idp}-price-label`} className="mb-1.5 text-sm font-medium">{label}</p>
        <p
          aria-labelledby={`${idp}-price-label`}
          aria-invalid={Boolean(error) || undefined}
          className={`rounded-xl border px-3.5 py-2.5 text-sm font-bold tabular-nums ${
            auto ? "border-border bg-primary-soft/40" : "border-dashed border-border-strong text-muted"
          }`}
        >
          {auto ? formatMoney(auto.listPrice) : "Cargá costo y ganancia"}
        </p>
        {cash !== null && auto && <p className="mt-1 text-xs text-muted">Efectivo: {formatMoney(cash)}</p>}
        {error && !auto && <p role="alert" className="mt-1 text-xs font-medium text-danger">{error}</p>}
        <button
          type="button"
          className={toggle}
          onClick={() => onChange({ manualPrice: true, price: auto ? String(auto.listPrice) : draft.price })}
        >
          <PencilSimple size={12} weight="bold" aria-hidden /> Poner a mano
        </button>
      </div>
    );
  }

  return (
    <div>
      <TextField
        id={`${idp}-price`}
        label={label}
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        value={draft.price}
        error={error}
        hint={cash !== null && Number.isFinite(cash) ? `Efectivo: ${formatMoney(cash)}` : undefined}
        onChange={(e) => onChange({ price: e.target.value })}
      />
      <button type="button" className={toggle} onClick={() => onChange({ manualPrice: false })}>
        <Calculator size={12} weight="bold" aria-hidden /> Calcular con la ganancia
      </button>
    </div>
  );
}
