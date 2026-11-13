import type { Metadata } from "next";
import { getCategories, getPromotions, listShopProducts, parseShopFilters, SHOP_PAGE_SIZE } from "@/back/landing/catalog";
import { ShopScreen } from "@/front/landing/shop/shop-screen";

export const metadata: Metadata = {
  title: "Tienda",
  description: "Mates, termos, bombillas, yerbas y combos. Armá tu pedido y confirmalo por WhatsApp.",
};

export default async function ShopPage({ searchParams }: PageProps<"/tienda">) {
  const filters = parseShopFilters(await searchParams);
  const [list, categories, promotions] = await Promise.all([listShopProducts(filters), getCategories(), getPromotions()]);
  const promotion = filters.promo ? (promotions.find((p) => p.slug === filters.promo) ?? null) : null;
  return <ShopScreen list={list} filters={filters} categories={categories} promotion={promotion} pageSize={SHOP_PAGE_SIZE} />;
}
