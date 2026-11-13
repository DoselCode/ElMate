import { getCategories, getHomeData, getPromotions } from "@/back/landing/catalog";
import { HomeScreen } from "@/front/landing/home/home-screen";

export const revalidate = 60;

export default async function HomePage() {
  const [data, categories, promotions] = await Promise.all([getHomeData(), getCategories(), getPromotions()]);
  return <HomeScreen data={data} categories={categories} promotions={promotions} />;
}
