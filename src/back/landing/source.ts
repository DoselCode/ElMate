import type { PublicCategory, PublicPaymentMethod, PublicProduct, PublicPromotion, PublicVariant, ShopFacets, ShopSort, StoreInfo } from "@/shared/types";

/**
 * Consultas básicas del catálogo público. Hay dos implementaciones con el mismo contrato:
 * - supabase-source.ts: la real, lee las vistas public_* de la base.
 * - demo-source.ts: datos de ejemplo en memoria, para ver la web sin base (ELMATE_DEMO=1).
 */
export type ProductQuery = {
  q?: string;
  category?: string;
  onlyOffers?: boolean;
  /** Solo los marcados como destacados en el panel. */
  featuredOnly?: boolean;
  /** Deja afuera los que se sacaron de "Novedades". */
  inNewsOnly?: boolean;
  /** Solo los que tienen al menos una foto (vidrieras de la home: destacados, ofertas, más vendidos). */
  withImages?: boolean;
  ids?: string[];
  excludeId?: string;
  /** Claves de marca (brand_key): cualquiera de ellas. */
  brands?: string[];
  /** Sobre el precio de la tarjeta (la variante más barata). */
  priceMin?: number;
  priceMax?: number;
  /** clave de opción -> valores: O dentro de cada opción, Y entre opciones. */
  options?: Record<string, string[]>;
  /** Solo con stock; las opciones se miran en las variantes con stock. */
  inStock?: boolean;
  sort: ShopSort | "mayor-descuento";
  limit: number;
  offset?: number;
};

/** Filtros con los que se cuentan las facetas de la tienda. */
export type FacetQuery = Pick<ProductQuery, "q" | "category" | "onlyOffers" | "ids" | "brands" | "priceMin" | "priceMax" | "options" | "inStock">;

export interface CatalogSource {
  storeInfo(): Promise<StoreInfo>;
  categories(): Promise<PublicCategory[]>;
  /** Promociones vigentes ahora (con o sin card en la home). */
  promotions(): Promise<PublicPromotion[]>;
  /** ids de los productos de una promoción vigente. */
  promotionProductIds(slug: string): Promise<string[]>;
  products(query: ProductQuery): Promise<{ rows: PublicProduct[]; total: number }>;
  /** Opciones de cada filtro de la tienda con su cantidad (facetas disyuntivas). */
  facets(query: FacetQuery): Promise<ShopFacets>;
  productBySlug(slug: string): Promise<PublicProduct | null>;
  variants(productId: string): Promise<PublicVariant[]>;
  /** ids de los más vendidos, en orden */
  bestSellerIds(): Promise<string[]>;
  /** Formas de pago activas con su ajuste sobre el precio de lista. */
  paymentMethods(): Promise<PublicPaymentMethod[]>;
}

export const EMPTY_STORE: StoreInfo = {
  name: "El Mate",
  tagline: null,
  logo: null,
  phone: null,
  whatsapp_number: null,
  address: null,
  instagram_url: null,
  hours_weekdays: null,
  hours_saturday: null,
  hours_sunday: null,
  instagram_posts: [],
};
