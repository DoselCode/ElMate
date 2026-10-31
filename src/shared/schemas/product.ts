import * as z from "zod";

const price = z
  .number({ error: "Ingresá un número" })
  .min(0, { error: "No puede ser negativo" })
  .max(999_999_999, { error: "El valor es demasiado grande" });

/** Hasta 3 decimales (kg); que sea entero para los productos por unidad se valida en el producto. */
export const quantity = z
  .number({ error: "Ingresá un número" })
  .min(0, { error: "No puede ser negativo" })
  .max(999_999, { error: "El valor es demasiado grande" })
  .refine((n) => Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6, { error: "Máximo 3 decimales" });

export const UNITS = ["unidad", "kg"] as const;

export const variantSchema = z
  .object({
    id: z.uuid().optional(),
    /** Vacío = lo genera la base (EM-00001). */
    sku: z.string().trim().max(40, { error: "Máximo 40 caracteres" }),
    barcode: z.string().trim().max(64, { error: "Máximo 64 caracteres" }),
    attributes: z.record(z.string(), z.string().trim().max(60, { error: "Máximo 60 caracteres" })),
    price,
    /** "Precio anterior": si está, la web lo muestra tachado y calcula el % de descuento. */
    compareAtPrice: price.nullable(),
    cost: price,
    /** % de ganancia sobre el precio en efectivo; con costo, el precio de lista se calcula solo. */
    marginPct: z
      .number({ error: "Ingresá un número" })
      .min(0, { error: "No puede ser negativo" })
      .max(99.99, { error: "Tiene que ser menor a 100" })
      .nullable(),
    minStock: quantity,
    /** Solo se usa al crear la variante; después el stock se mueve con ingresos y ajustes. */
    initialStock: quantity,
    active: z.boolean(),
  })
  .refine((v) => v.compareAtPrice === null || v.compareAtPrice > v.price, {
    path: ["compareAtPrice"],
    error: "Tiene que ser mayor al precio de venta",
  });

export const productSchema = z
  .object({
    id: z.uuid().optional(),
    name: z
      .string()
      .trim()
      .min(2, { error: "El nombre es obligatorio (mínimo 2 caracteres)" })
      .max(150, { error: "Máximo 150 caracteres" }),
    description: z.string().trim().max(2000, { error: "Máximo 2000 caracteres" }),
    categoryId: z.uuid().nullable(),
    supplierId: z.uuid().nullable(),
    brand: z.string().trim().max(80, { error: "Máximo 80 caracteres" }),
    /** "kg" permite vender con decimales (yerba a granel). */
    unit: z.enum(UNITS),
    /** false = servicio o producto sin inventario (ej: grabados). */
    trackStock: z.boolean(),
    /** Ejes de variación, ej: ["Color", "Tamaño"]. Vacío = producto sin variantes. */
    optionNames: z
      .array(z.string().trim().min(1, { error: "La opción no puede estar vacía" }).max(30, { error: "Máximo 30 caracteres" }))
      .max(3, { error: "Máximo 3 opciones (ej: Color, Tamaño, Material)" }),
    images: z.array(z.url({ error: "Imagen inválida" })).max(6, { error: "Máximo 6 imágenes" }),
    isVisible: z.boolean(),
    badge: z.string().trim().max(50, { error: "Máximo 50 caracteres" }),
    /** Opciones de la web: destacado en la home, aparecer en Novedades y orden manual (menor = primero). */
    isFeatured: z.boolean().default(false),
    showInNews: z.boolean().default(true),
    webOrder: z
      .number({ error: "Ingresá un número" })
      .int({ error: "Sin decimales" })
      .min(0, { error: "Entre 0 y 9999" })
      .max(9999, { error: "Entre 0 y 9999" })
      .nullable()
      .default(null),
    variants: z
      .array(variantSchema)
      .min(1, { error: "Agregá al menos una variante" })
      .max(100, { error: "Máximo 100 variantes por producto" }),
  })
  .superRefine((p, ctx) => {
    const names = p.optionNames.map((n) => n.toLowerCase());
    if (new Set(names).size !== names.length) {
      ctx.addIssue({ code: "custom", path: ["optionNames"], message: "Hay opciones repetidas" });
    }
    if (p.optionNames.length === 0 && p.variants.length !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["variants"],
        message: "Sin opciones el producto tiene una sola variante. Definí opciones (ej: Color) para cargar más.",
      });
    }

    if (p.unit === "unidad") {
      p.variants.forEach((v, i) => {
        for (const field of ["minStock", "initialStock"] as const) {
          if (!Number.isInteger(v[field])) {
            ctx.addIssue({ code: "custom", path: ["variants", i, field], message: "Por unidad: sin decimales" });
          }
        }
      });
    }

    const seenCombos = new Map<string, number>();
    const seenSkus = new Map<string, number>();
    p.variants.forEach((v, i) => {
      for (const name of p.optionNames) {
        if (!v.attributes[name]?.trim()) {
          ctx.addIssue({ code: "custom", path: ["variants", i, "attributes", name], message: `Completá ${name}` });
        }
      }
      const combo = p.optionNames.map((n) => (v.attributes[n] ?? "").trim().toLowerCase()).join("|");
      if (seenCombos.has(combo) && p.optionNames.length > 0) {
        ctx.addIssue({ code: "custom", path: ["variants", i, "attributes"], message: "Esta combinación ya está cargada" });
      }
      seenCombos.set(combo, i);

      const sku = v.sku.trim().toUpperCase();
      if (sku) {
        if (seenSkus.has(sku)) {
          ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: "Código repetido" });
        }
        seenSkus.set(sku, i);
      }
    });
  });

export type ProductInput = z.input<typeof productSchema>;
export type ProductData = z.output<typeof productSchema>;

/** Arma el JSON que espera la función SQL save_product(). */
export function toSavePayload(p: ProductData, slug: string) {
  return {
    id: p.id ?? null,
    name: p.name,
    slug,
    description: p.description,
    category_id: p.categoryId,
    supplier_id: p.supplierId,
    brand: p.brand || null,
    unit: p.unit,
    track_stock: p.trackStock,
    option_names: p.optionNames,
    images: p.images,
    is_visible: p.isVisible,
    badge: p.badge || null,
    is_featured: p.isFeatured,
    show_in_news: p.showInNews,
    web_order: p.webOrder,
    variants: p.variants.map((v) => ({
      id: v.id ?? null,
      sku: v.sku,
      barcode: v.barcode || null,
      // Solo los ejes vigentes: si se quitó una opción, su valor viejo no viaja
      attributes: Object.fromEntries(p.optionNames.map((n) => [n, (v.attributes[n] ?? "").trim()])),
      price: v.price,
      compare_at_price: v.compareAtPrice,
      cost: v.cost,
      margin_pct: v.marginPct,
      min_stock: p.trackStock ? v.minStock : 0,
      active: v.active,
      // Sin control de stock no hay stock inicial (la base lo rechazaría)
      ...(v.id ? {} : { initial_stock: p.trackStock ? v.initialStock : 0 }),
    })),
  };
}

/** { "variants.0.price": "No puede ser negativo" }: primer mensaje por campo, para pintar errores en el formulario. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
