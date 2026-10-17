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
  compareAtPrice: number | null;
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
export type ProductPageData = { product: PublicProduct; variants: PublicVariant[]; related: PublicProduct[] };

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
