import type { Metadata } from "next";
import { getCategories, listShopProducts, parseShopFilters, SHOP_PAGE_SIZE } from "@/back/landing/catalog";
import { ShopScreen } from "@/front/landing/shop/shop-screen";

export const metadata: Metadata = {
  title: "Tienda",
  description: "Mates, termos, bombillas, yerbas y combos. Armá tu pedido y confirmalo por WhatsApp.",
};

export default async function ShopPage({ searchParams }: PageProps<"/tienda">) {
  const filters = parseShopFilters(await searchParams);
  const [list, categories] = await Promise.all([listShopProducts(filters), getCategories()]);
  return <ShopScreen list={list} filters={filters} categories={categories} pageSize={SHOP_PAGE_SIZE} />;
}
