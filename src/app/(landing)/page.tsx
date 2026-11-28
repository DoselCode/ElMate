import { getCategories, getHomeData, getPromotions, getPromotionShowcase, getStoreInfo } from "@/back/landing/catalog";
import { HomeScreen } from "@/front/landing/home/home-screen";

export const revalidate = 60;

export default async function HomePage() {
  const [data, categories, promotions, store] = await Promise.all([getHomeData(), getCategories(), getPromotions(), getStoreInfo()]);
  // Fotos de los productos de cada card de promo (la home muestra hasta 2 cards)
  const cards = promotions.filter((p) => p.show_card).slice(0, 2);
  const showcase = Object.fromEntries(await Promise.all(cards.map(async (p) => [p.slug, await getPromotionShowcase(p.slug)] as const)));
  return <HomeScreen data={data} categories={categories} promotions={promotions} store={store} promoShowcase={showcase} />;
}
