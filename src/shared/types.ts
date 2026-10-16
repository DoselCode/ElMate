/**
 * Tipos compartidos entre front y back: lo que el back devuelve y el front muestra.
 * Las filas reflejan las vistas de la base (ver supabase/migrations).
 */

// ---- Usuarios ------------------------------------------------------------------------------

export type Role = "admin" | "empleado";

// ---- Stock ---------------------------------------------------------------------------------

/** Fila de la vista stock_overview: una variante con los datos de su producto. */
export type StockRow = {
  variant_id: string;
  product_id: string;
  sku: string;
  barcode: string | null;
  attributes: Record<string, string>;
  variant_label: string;
  product_name: string;
  slug: string;
  category_id: string | null;
  category_name: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  image: string | null;
  price: number;
  /** null si quien consulta no es admin (RLS). */
  cost: number | null;
  stock: number;
  min_stock: number;
  low_stock: boolean;
  active: boolean;
  is_visible: boolean;
  is_featured: boolean;
};

/** Filtros del listado de inventario (vienen de la URL). */
export type StockFilters = {
  q: string;
  supplier: string;
  category: string;
  /** "" = todo, "low" = bajo o agotado, "out" = sin stock */
  status: "" | "low" | "out";
  showInactive: boolean;
  page: number;
};

export type StockSummary = { total: number; low: number; out: number };

export type MovementType = "ingreso" | "venta" | "ajuste" | "anulacion";

/** Fila de la vista stock_movement_log. */
export type MovementRow = {
  id: number;
  created_at: string;
  type: MovementType;
  quantity: number;
  stock_after: number;
  reason: string | null;
  sale_id: string | null;
  ticket_number: number | null;
  variant_id: string;
  sku: string;
  product_name: string;
  variant_label: string;
  created_by: string | null;
  created_by_name: string | null;
};

export type MovementFilters = {
  q: string;
  type: MovementType | "";
  page: number;
};

/** Una página de resultados. `error` indica que la consulta falló (se muestra un aviso). */
export type Paged<T> = { rows: T[]; total: number; error: boolean };

// ---- Productos (formulario de alta/edición) ------------------------------------------------

export type Option = { id: string; name: string };

export type VariantForEdit = {
  id: string;
  sku: string;
  barcode: string | null;
  attributes: Record<string, string>;
  price: number;
  cost: number;
  minStock: number;
  stock: number;
  active: boolean;
};

export type ProductForEdit = {
  id: string;
  name: string;
  description: string;
  categoryId: string | null;
  supplierId: string | null;
  optionNames: string[];
  images: string[];
  isVisible: boolean;
  badge: string | null;
  variants: VariantForEdit[];
};

// ---- Acciones ------------------------------------------------------------------------------

/** Resultado de una Server Action: nunca lanza al cliente, siempre devuelve algo mostrable. */
export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
