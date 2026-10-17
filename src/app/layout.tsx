import type { Metadata } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import "@/front/shared/styles/globals.css";

// Tipografías del diseño: Nunito (texto) y Baloo 2 (títulos)
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });
const baloo = Baloo_2({ variable: "--font-baloo", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "El Mate · Todo para tu ronda", template: "%s · El Mate" },
  description: "Mates, termos, bombillas, yerbas y combos. Armá tu pedido y confirmalo por WhatsApp.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${nunito.variable} ${baloo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
