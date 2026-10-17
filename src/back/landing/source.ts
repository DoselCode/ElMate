import type { PublicCategory, PublicProduct, PublicVariant, ShopSort, StoreInfo } from "@/shared/types";

/**
 * Consultas básicas del catálogo público. Hay dos implementaciones con el mismo contrato:
 * - supabase-source.ts: la real, lee las vistas public_* de la base.
 * - demo-source.ts: datos de ejemplo en memoria, para ver la web sin base (ELMATE_DEMO=1).
 */
export type ProductQuery = {
  q?: string;
  category?: string;
  onlyOffers?: boolean;
  ids?: string[];
  excludeId?: string;
  sort: ShopSort | "mayor-descuento";
  limit: number;
  offset?: number;
};

export interface CatalogSource {
  storeInfo(): Promise<StoreInfo>;
  categories(): Promise<PublicCategory[]>;
  products(query: ProductQuery): Promise<{ rows: PublicProduct[]; total: number }>;
  productBySlug(slug: string): Promise<PublicProduct | null>;
  variants(productId: string): Promise<PublicVariant[]>;
  /** ids de los más vendidos, en orden */
  bestSellerIds(): Promise<string[]>;
}

export const EMPTY_STORE: StoreInfo = {
  name: "El Mate",
  tagline: null,
  logo: null,
  phone: null,
  whatsapp_number: null,
  email: null,
  address: null,
  instagram_url: null,
  facebook_url: null,
  hours_weekdays: null,
  hours_saturday: null,
  hours_sunday: null,
};
