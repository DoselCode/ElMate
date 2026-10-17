import { slugify } from "@/shared/slug";
import type { PublicCategory, PublicProduct, PublicVariant } from "@/shared/types";
import { EMPTY_STORE, type CatalogSource, type ProductQuery } from "./source";

/**
 * Catálogo de ejemplo en memoria, para ver y probar la web sin base de datos (ELMATE_DEMO=1).
 * Los nombres y precios salen del diseño de Figma. No se usa en producción.
 */

type DemoVariant = { label?: Record<string, string>; price: number; compareAt?: number; inStock?: boolean };
type DemoProduct = {
  name: string;
  category: string;
  description: string;
  options?: string[];
  variants: DemoVariant[];
  badge?: string;
  daysAgo: number;
};

const CATEGORIES: Omit<PublicCategory, "product_count">[] = [
  { id: "c-mates", name: "Mates", slug: "mates", image: null, sort_order: 1 },
  { id: "c-termos", name: "Termos", slug: "termos", image: null, sort_order: 2 },
  { id: "c-bombillas", name: "Bombillas", slug: "bombillas", image: null, sort_order: 3 },
  { id: "c-yerbas", name: "Yerbas", slug: "yerbas", image: null, sort_order: 4 },
  { id: "c-combos", name: "Combos", slug: "combos", image: null, sort_order: 5 },
];

const PRODUCTS: DemoProduct[] = [
  {
    name: "Mate imperial de calabaza con virola de alpaca",
    category: "mates",
    description: "Calabaza seleccionada, forrada en cuero y con virola de alpaca cincelada a mano.",
    options: ["Color"],
    variants: [
      { label: { Color: "Marrón" }, price: 24900, compareAt: 29900 },
      { label: { Color: "Negro" }, price: 24900, compareAt: 29900 },
    ],
    badge: "Más vendido",
    daysAgo: 40,
  },
  {
    name: "Termo de acero inoxidable 1 L con pico cebador",
    category: "termos",
    description: "Doble pared de acero: mantiene el agua caliente todo el día. Pico cebador de precisión.",
    options: ["Color"],
    variants: [
      { label: { Color: "Acero" }, price: 79900, compareAt: 94900 },
      { label: { Color: "Negro" }, price: 79900, compareAt: 94900 },
      { label: { Color: "Verde" }, price: 82900, inStock: false },
    ],
    daysAgo: 35,
  },
  {
    name: "Yerba mate orgánica despalada 1 kg",
    category: "yerbas",
    description: "Yerba sin palo, de cultivo orgánico. Sabor intenso y parejo.",
    variants: [{ price: 6490, compareAt: 7990 }],
    daysAgo: 30,
  },
  {
    name: "Bombilla pico de loro de alpaca",
    category: "bombillas",
    description: "Filtrado perfecto y brillo que dura. Ideal para yerbas con palo.",
    variants: [{ price: 12900, compareAt: 14900 }],
    daysAgo: 28,
  },
  {
    name: "Combo matero completo: mate + bombilla + termo",
    category: "combos",
    description: "Todo para empezar a cebar: mate de calabaza, bombilla de alpaca y termo de 1 L.",
    variants: [{ price: 89900, compareAt: 109900 }],
    badge: "Ideal para regalar",
    daysAgo: 25,
  },
  {
    name: "Mate camionero de calabaza forrado en cuero",
    category: "mates",
    description: "Boca ancha y base firme, el clásico de la ruta.",
    options: ["Tamaño"],
    variants: [
      { label: { Tamaño: "Mediano" }, price: 18500 },
      { label: { Tamaño: "Grande" }, price: 21500 },
    ],
    daysAgo: 20,
  },
  {
    name: "Yerba barbacuá misionera 500 g",
    category: "yerbas",
    description: "Secado barbacuá con leña: notas ahumadas y cuerpo pleno.",
    variants: [{ price: 3890, compareAt: 4490 }],
    daysAgo: 15,
  },
  {
    name: "Mate de algarrobo torneado a mano",
    category: "mates",
    description: "Madera de algarrobo torneada por artesanos. Curado incluido.",
    variants: [{ price: 11900 }],
    daysAgo: 6,
  },
  {
    name: "Termo media manija 750 ml verde",
    category: "termos",
    description: "Compacto y liviano, con manija plegable.",
    variants: [{ price: 54900, compareAt: 59900 }],
    daysAgo: 5,
  },
  {
    name: "Bombilla de acero con filtro plano",
    category: "bombillas",
    description: "Acero inoxidable, fácil de limpiar.",
    variants: [{ price: 7990, inStock: false }],
    daysAgo: 4,
  },
  {
    name: "Yerba orgánica suave 1 kg",
    category: "yerbas",
    description: "Molienda suave, ideal para empezar el día.",
    variants: [{ price: 6990, compareAt: 7490 }],
    daysAgo: 2,
  },
  {
    name: "Combo regalo: mate + yerba",
    category: "combos",
    description: "Mate de algarrobo y yerba orgánica de 500 g en caja de regalo.",
    variants: [{ price: 16900 }],
    daysAgo: 1,
  },
];

const NOW = Date.now();

const VARIANTS: PublicVariant[] = PRODUCTS.flatMap((p, pi) =>
  p.variants.map((v, vi) => ({
    id: `v-${pi}-${vi}`,
    product_id: `p-${pi}`,
    attributes: v.label ?? {},
    label: Object.values(v.label ?? {}).join(" / "),
    price: v.price,
    compare_at_price: v.compareAt ?? null,
    image: null,
    in_stock: v.inStock ?? true,
  })),
);

const ALL: PublicProduct[] = PRODUCTS.map((p, pi) => {
  const variants = VARIANTS.filter((v) => v.product_id === `p-${pi}`);
  const cheapest = [...variants].sort((a, b) => a.price - b.price)[0];
  const category = CATEGORIES.find((c) => c.slug === p.category)!;
  return {
    id: `p-${pi}`,
    name: p.name,
    slug: slugify(p.name),
    description: p.description,
    images: [],
    badge: p.badge ?? null,
    option_names: p.options ?? [],
    created_at: new Date(NOW - p.daysAgo * 86_400_000).toISOString(),
    brand: null,
    unit: "unidad",
    category_name: category.name,
    category_slug: category.slug,
    variant_id: cheapest.id,
    price: cheapest.price,
    compare_at_price: cheapest.compare_at_price,
    discount_pct: cheapest.compare_at_price ? Math.round(100 * (1 - cheapest.price / cheapest.compare_at_price)) : null,
    variant_count: variants.length,
    has_price_range: new Set(variants.map((v) => v.price)).size > 1,
    in_stock: variants.some((v) => v.in_stock),
  };
});

const BEST_SELLERS = ["p-4", "p-0", "p-1", "p-6"];

function matches(p: PublicProduct, q: ProductQuery) {
  const text = (s: string) => slugify(s).replace(/-/g, " ");
  if (q.q && !text(p.name).includes(text(q.q))) return false;
  if (q.category && p.category_slug !== q.category) return false;
  if (q.onlyOffers && p.compare_at_price === null) return false;
  if (q.ids && !q.ids.includes(p.id)) return false;
  if (q.excludeId && p.id === q.excludeId) return false;
  return true;
}

const SORTS: Record<ProductQuery["sort"], (a: PublicProduct, b: PublicProduct) => number> = {
  destacados: (a, b) => Number(b.in_stock) - Number(a.in_stock),
  "precio-asc": (a, b) => a.price - b.price,
  "precio-desc": (a, b) => b.price - a.price,
  nuevos: (a, b) => b.created_at.localeCompare(a.created_at),
  "mayor-descuento": (a, b) => (b.discount_pct ?? -1) - (a.discount_pct ?? -1),
};

export const demoSource: CatalogSource = {
  async storeInfo() {
    // Sin WhatsApp a propósito: el demo no debe mandar pedidos a un número real
    return { ...EMPTY_STORE, tagline: "Todo para tu ronda de mate" };
  },
  async categories() {
    return CATEGORIES.map((c) => ({ ...c, product_count: ALL.filter((p) => p.category_slug === c.slug).length }));
  },
  async products(q) {
    const filtered = ALL.filter((p) => matches(p, q)).sort(SORTS[q.sort]);
    const offset = q.offset ?? 0;
    return { rows: filtered.slice(offset, offset + q.limit), total: filtered.length };
  },
  async productBySlug(slug) {
    return ALL.find((p) => p.slug === slug) ?? null;
  },
  async variants(productId) {
    return VARIANTS.filter((v) => v.product_id === productId).sort((a, b) => a.price - b.price);
  },
  async bestSellerIds() {
    return BEST_SELLERS;
  },
  async paymentMethods() {
    return [
      { name: "Efectivo", adjustment_pct: -20, is_cash: true, sort_order: 1 },
      { name: "Transferencia", adjustment_pct: -15, is_cash: false, sort_order: 2 },
      { name: "Débito", adjustment_pct: -15, is_cash: false, sort_order: 3 },
      { name: "Crédito 3 cuotas", adjustment_pct: -10, is_cash: false, sort_order: 4 },
      { name: "Crédito 6 cuotas", adjustment_pct: 0, is_cash: false, sort_order: 5 },
    ];
  },
};
