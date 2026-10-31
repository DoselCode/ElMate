import { getCategories, getHomeContent, getHomeData } from "@/back/landing/catalog";
import { HomeScreen } from "@/front/landing/home/home-screen";

export const revalidate = 60;

export default async function HomePage() {
  const [data, categories, content] = await Promise.all([getHomeData(), getCategories(), getHomeContent()]);
  return <HomeScreen data={data} categories={categories} content={content} />;
}
