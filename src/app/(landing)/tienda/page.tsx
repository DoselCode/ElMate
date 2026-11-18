import type { Metadata } from "next";
import { getCategories, getPromotions, getShopFacets, listShopProducts, resolveShopFilters, SHOP_PAGE_SIZE } from "@/back/landing/catalog";
import { ShopScreen } from "@/front/landing/shop/shop-screen";

export const metadata: Metadata = {
  title: "Tienda",
  description: "Mates, termos, bombillas, yerbas y combos. Armá tu pedido y confirmalo por WhatsApp.",
};

export default async function ShopPage({ searchParams }: PageProps<"/tienda">) {
  const filters = await resolveShopFilters(await searchParams);
  const [list, facets, categories, promotions] = await Promise.all([listShopProducts(filters), getShopFacets(filters), getCategories(), getPromotions()]);
  const promotion = filters.promo ? (promotions.find((p) => p.slug === filters.promo) ?? null) : null;
  return <ShopScreen list={list} filters={filters} facets={facets} categories={categories} promotion={promotion} pageSize={SHOP_PAGE_SIZE} />;
}
