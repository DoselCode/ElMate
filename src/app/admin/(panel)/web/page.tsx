import type { Metadata } from "next";
import { getHomeTexts } from "@/back/admin/web/queries";
import { HomeTextsForm } from "@/front/admin/web/home-texts-form";

export const metadata: Metadata = { title: "Textos de la web" };

export default async function WebTextsPage() {
  return <HomeTextsForm initial={await getHomeTexts()} />;
}
