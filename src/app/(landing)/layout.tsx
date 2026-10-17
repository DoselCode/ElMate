import { getCategories, getStoreInfo } from "@/back/landing/catalog";
import { SiteShell } from "@/front/landing/layout/site-shell";

// La web pública se regenera como mucho cada 60 s; al guardar desde el panel se refresca al instante.
export const revalidate = 60;

export default async function LandingLayout({ children }: LayoutProps<"/">) {
  const [store, categories] = await Promise.all([getStoreInfo(), getCategories()]);
  return (
    <SiteShell store={store} categories={categories}>
      {children}
    </SiteShell>
  );
}
