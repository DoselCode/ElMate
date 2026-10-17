import type { ReactNode } from "react";
import type { PublicCategory, StoreInfo } from "@/shared/types";
import { normalizeWhatsappNumber } from "@/shared/whatsapp";
import { CartDrawer } from "../cart/cart-drawer";
import { CartProvider } from "../cart/cart-provider";
import { SiteFooter } from "./site-footer";
import { SiteHeader, type NavLink } from "./site-header";

/** Marco de todas las páginas públicas: header, carrito, contenido y footer. */
export function SiteShell({
  store,
  categories,
  children,
}: {
  store: StoreInfo;
  categories: PublicCategory[];
  children: ReactNode;
}) {
  const links: NavLink[] = [
    { href: "/", label: "Inicio" },
    {
      href: "/tienda",
      label: "Categorías",
      children: categories.map((c) => ({ href: `/tienda?categoria=${c.slug}`, label: c.name })),
    },
    { href: "/tienda", label: "Tienda" },
    { href: "#contacto", label: "Contacto" },
  ];

  return (
    <CartProvider>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
      >
        Saltar al contenido
      </a>
      <SiteHeader storeName={store.name} links={links} />
      <main id="contenido" className="flex-1 overflow-x-clip">
        {children}
      </main>
      <SiteFooter store={store} categories={categories} />
      <CartDrawer whatsapp={normalizeWhatsappNumber(store.whatsapp_number)} storeName={store.name} />
    </CartProvider>
  );
}
