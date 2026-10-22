/**
 * Tipos compartidos entre front y back: lo que el back devuelve y el front muestra.
 * Las filas reflejan las vistas de la base (ver supabase/migrations).
 */

// ---- Usuarios ------------------------------------------------------------------------------

export type Role = "admin" | "empleado";

/** Cómo se vende un producto: por unidad o por kilo (con decimales). */
export type Unit = "unidad" | "kg";

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
  brand: string | null;
  unit: Unit;
  /** false = sin control de stock (servicios como grabados). */
  track_stock: boolean;
  category_id: string | null;
  category_name: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  image: string | null;
  price: number;
  compare_at_price: number | null;
  /** null si quien consulta no es admin (RLS). */
  cost: number | null;
  margin_pct: number | null;
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
  unit: Unit;
  variant_label: string;
  created_by: string | null;
  created_by_name: string | null;
};

export type MovementFilters = {
  q: string;
  type: MovementType | "";
  page: number;
};

/** Forma de pago del local (tabla payment_methods). */
export type PaymentMethod = {
  id: string;
  name: string;
  /** Sobre el precio de lista: −20 = 20 % de descuento. */
  adjustment_pct: number;
  /** Suma al efectivo esperado de la caja. */
  is_cash: boolean;
  sort_order: number;
  active: boolean;
};

// ---- Caja y ventas ------------------------------------------------------------------------

/** Totales de una caja (vista cash_session_summary). */
export type CashSummary = {
  session_id: string;
  status: "abierta" | "cerrada";
  opening_cash: number;
  opened_at: string;
  cash_sales: number;
  other_sales: number;
  sales_total: number;
  sales_count: number;
  cash_in: number;
  cash_out: number;
  expected_cash: number;
};

export type CashMethodTotal = { payment_method_name: string; payment_is_cash: boolean; sales_count: number; total: number };

export type CashMovementRow = {
  id: string;
  type: "ingreso" | "egreso";
  amount: number;
  reason: string;
  created_at: string;
  created_by_name: string | null;
};

/** Estado de la caja para la pantalla de Caja. `open` es null si está cerrada. */
export type CashState = {
  registerId: string | null;
  open: { summary: CashSummary; byMethod: CashMethodTotal[]; movements: CashMovementRow[] } | null;
  /** Lo que quedó en la caja al último cierre: se propone como monto inicial. */
  suggestedOpening: number;
};

export type ClosedSessionRow = {
  id: string;
  opened_at: string;
  closed_at: string;
  opening_cash: number;
  cash_sales: number;
  other_sales: number;
  expected_cash: number;
  counted_cash: number;
  difference: number;
  cash_left: number;
  notes: string | null;
  closed_by_name: string | null;
};

/** Producto vendible en la pantalla de venta (una fila por variante activa). */
export type SellableItem = {
  variant_id: string;
  product_name: string;
  variant_label: string;
  sku: string;
  barcode: string | null;
  brand: string | null;
  category_name: string | null;
  price: number;
  stock: number;
  unit: Unit;
  track_stock: boolean;
  image: string | null;
};

/** Fila de la vista sales_log. */
export type SaleRow = {
  id: string;
  ticket_number: number;
  created_at: string;
  customer_name: string | null;
  payment_method_name: string;
  payment_is_cash: boolean;
  subtotal: number;
  discount_amount: number;
  /** % del descuento general, si se cargó en porcentaje. */
  discount_pct: number | null;
  adjustment_pct: number;
  adjustment_amount: number;
  total: number;
  status: "pagada" | "anulada";
  notes: string | null;
  void_reason: string | null;
  seller_name: string | null;
  item_count: number;
  summary: string | null;
};

export type SaleItemRow = {
  product_name: string;
  variant_label: string;
  sku: string;
  quantity: number;
  unit: Unit;
  unit_price: number;
  /** Descuento de la línea: monto y, si se cargó en %, el porcentaje. */
  discount_pct: number | null;
  discount_amount: number;
  line_total: number;
};

/** Datos del local para el encabezado del ticket. */
export type TicketStore = {
  name: string;
  address: string | null;
  phone: string | null;
  legal_name: string | null;
  cuit: string | null;
  tax_condition: string | null;
};

export type SaleDetail = { sale: SaleRow; items: SaleItemRow[]; store: TicketStore };

export type SalesFilters = {
  /** YYYY-MM-DD (hora argentina) */
  from: string;
  to: string;
  method: string;
  status: "" | "pagada" | "anulada";
  page: number;
};

/** Totales del período filtrado (solo ventas pagadas). */
export type SalesTotals = { count: number; total: number; byMethod: { name: string; total: number }[] };

/** Un mes del reporte de Ingresos: ventas del sistema + totales históricos importados. */
export type IncomeMonth = {
  /** YYYY-MM-01 */
  month: string;
  cash: number;
  other: number;
  total: number;
  salesCount: number;
  /** Total de las ventas cargadas en el sistema (sin el historial importado). */
  systemTotal: number;
  /** Costo de lo vendido en el sistema; null si no hay ventas del sistema. */
  cost: number | null;
  /** De dónde salen los datos del mes. */
  source: "sistema" | "historial" | "ambos" | "sin datos";
  byMethod: { name: string; total: number }[];
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
  compareAtPrice: number | null;
  cost: number;
  marginPct: number | null;
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
  brand: string | null;
  unit: Unit;
  trackStock: boolean;
  optionNames: string[];
  images: string[];
  isVisible: boolean;
  badge: string | null;
  variants: VariantForEdit[];
};

// ---- Web pública (vistas public_* de la base) ----------------------------------------------

/** Producto como se ve en la tienda: la tarjeta usa la variante más barata. */
export type PublicProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  images: string[];
  badge: string | null;
  option_names: string[];
  created_at: string;
  brand: string | null;
  /** "kg": el precio es por kilo. */
  unit: Unit;
  category_name: string | null;
  category_slug: string | null;
  /** Variante más barata: la que se agrega al carrito desde la tarjeta si es la única. */
  variant_id: string;
  price: number;
  compare_at_price: number | null;
  discount_pct: number | null;
  variant_count: number;
  /** Las variantes tienen precios distintos: la tarjeta muestra "Desde". */
  has_price_range: boolean;
  in_stock: boolean;
};

export type PublicVariant = {
  id: string;
  product_id: string;
  attributes: Record<string, string>;
  /** "Negro / Grande"; vacío si el producto no tiene opciones. */
  label: string;
  price: number;
  compare_at_price: number | null;
  image: string | null;
  in_stock: boolean;
};

export type PublicCategory = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  sort_order: number;
  product_count: number;
};

export type StoreInfo = {
  name: string;
  tagline: string | null;
  logo: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  email: string | null;
  address: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  hours_weekdays: string | null;
  hours_saturday: string | null;
  hours_sunday: string | null;
};

export type ShopSort = "destacados" | "precio-asc" | "precio-desc" | "nuevos";

/** Filtros de /tienda (vienen de la URL). */
export type ShopFilters = {
  q: string;
  /** slug de la categoría */
  category: string;
  sort: ShopSort;
  offers: boolean;
  page: number;
};

/** Secciones de productos de la home. */
export type HomeData = { offers: PublicProduct[]; bestSellers: PublicProduct[]; newest: PublicProduct[] };

/** Página de un producto: el producto, sus variantes y relacionados de la misma categoría. */
/** Resultado del buscador del header (lo mínimo para mostrar la fila). */
export type SearchResult = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  price: number;
  compare_at_price: number | null;
  has_price_range: boolean;
  unit: Unit;
  category_name: string | null;
};

/** Forma de pago como la ve la web (vista public_payment_methods). */
export type PublicPaymentMethod = { name: string; adjustment_pct: number; is_cash: boolean; sort_order: number };

export type ProductPageData = {
  product: PublicProduct;
  variants: PublicVariant[];
  related: PublicProduct[];
  paymentMethods: PublicPaymentMethod[];
};

/** Ítem del carrito. Guarda una copia del precio al agregarlo: el pedido final se confirma por WhatsApp. */
export type CartItem = {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantLabel: string;
  price: number;
  image: string | null;
  quantity: number;
};

// ---- Acciones ------------------------------------------------------------------------------

/** Resultado de una Server Action: nunca lanza al cliente, siempre devuelve algo mostrable. */
export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
