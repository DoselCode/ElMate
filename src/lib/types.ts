/** Filas de las vistas stock_overview y stock_movement_log (ver supabase/migrations). */
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

export type MovementType = "ingreso" | "venta" | "ajuste" | "anulacion";

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

export type Option = { id: string; name: string };

/** Resultado de una Server Action: nunca lanza al cliente, siempre devuelve algo mostrable. */
export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
