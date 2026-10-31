import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "@/front/shared/styles/globals.css";

// Barlow (texto) y Barlow Condensed (títulos): condensada y pesada, cercana a las letras apiladas del logo
const barlow = Barlow({ variable: "--font-barlow", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const barlowCondensed = Barlow_Condensed({ variable: "--font-barlow-condensed", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "El Mate · Todo para tu ronda", template: "%s · El Mate" },
  description: "Mates, termos, bombillas, yerbas y combos. Armá tu pedido y confirmalo por WhatsApp.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" data-scroll-behavior="smooth" className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
