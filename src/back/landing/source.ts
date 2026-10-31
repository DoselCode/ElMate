import type { HomeTexts } from "@/shared/home-content";
import type { PublicCategory, PublicPaymentMethod, PublicProduct, PublicVariant, ShopSort, StoreInfo } from "@/shared/types";

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
  ids?: string[];
  excludeId?: string;
  sort: ShopSort | "mayor-descuento";
  limit: number;
  offset?: number;
};

export interface CatalogSource {
  storeInfo(): Promise<StoreInfo>;
  /** Textos de la home que el usuario cambió desde el panel (el resto usa los de por defecto). */
  homeTexts(): Promise<HomeTexts>;
  categories(): Promise<PublicCategory[]>;
  products(query: ProductQuery): Promise<{ rows: PublicProduct[]; total: number }>;
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
  email: null,
  address: null,
  instagram_url: null,
  facebook_url: null,
  hours_weekdays: null,
  hours_saturday: null,
  hours_sunday: null,
};
