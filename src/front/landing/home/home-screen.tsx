import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CaretDoubleDown,
  CaretRight,
  ChatCircleDots,
  Gift,
  Leaf,
  ShoppingCartSimple,
  Storefront,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import type { HomeData, PublicCategory, PublicProduct } from "@/shared/types";
import { ProductCard, ProductGrid } from "../catalog/product-card";
import { BENEFITS, HERO, SECTIONS } from "../content";
import { CategoryCarousel } from "./category-carousel";
import { SectionHeading, type SectionHeadingProps } from "./section-heading";

// 82rem de contenido (igual que el header) + el padding lateral: el contenido queda alineado con los bordes del header
const container = "mx-auto max-w-[85rem] px-4 sm:px-6";
const btnPrimary =
  "inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-white shadow-sm transition-colors hover:bg-primary-hover";
const btnOutline =
  "inline-flex items-center gap-2 rounded-full border-2 border-primary/25 px-6 py-3 font-bold text-foreground transition-colors hover:border-primary hover:text-primary";

/** Link a una categoría por palabra clave ("combo" → /tienda?categoria=combos), o a la tienda si no existe. */
function categoryHref(categories: PublicCategory[], keyword: string) {
  const c = categories.find((c) => c.slug.includes(keyword));
  return c ? `/tienda?categoria=${c.slug}` : "/tienda";
}

function uniqueProducts(products: PublicProduct[]) {
  return products.filter((p, i) => products.findIndex((q) => q.id === p.id) === i);
}

export function HomeScreen({ data, categories }: { data: HomeData; categories: PublicCategory[] }) {
  return (
    <>
      <Hero />
      <Categories categories={categories} />
      {/* Sin productos en oferta se muestran destacados, para que la sección no quede vacía */}
      {data.offers.length > 0 ? (
        <Offers heading={SECTIONS.offers} products={data.offers.slice(0, 3)} />
      ) : (
        <Offers heading={SECTIONS.featured} products={uniqueProducts([...data.bestSellers, ...data.newest]).slice(0, 3)} />
      )}
      <Ritual combosHref={categoryHref(categories, "combo")} />
      {data.bestSellers.length > 0 && (
        <section className={`${container} mt-24`}>
          <SectionHeading {...SECTIONS.bestSellers} />
          <ProductGrid products={data.bestSellers} reveal />
        </section>
      )}
      {data.newest.length > 0 && (
        <section className={`${container} mt-24`}>
          <SectionHeading {...SECTIONS.newest} />
          <ProductGrid products={data.newest} reveal />
        </section>
      )}
      <Promos bombillasHref={categoryHref(categories, "bombilla")} combosHref={categoryHref(categories, "combo")} />
    </>
  );
}

function Hero() {
  return (
    <section className="relative isolate">
      {/* Brillo verde suave detrás de la foto, como en el diseño */}
      <span
        className="pointer-events-none absolute -left-48 -top-56 -z-10 size-[46rem] rounded-full bg-primary-soft/80 blur-3xl"
        aria-hidden
      />
      <div className={`${container} grid items-center gap-12 pt-8 lg:grid-cols-[minmax(0,38rem)_1fr] lg:gap-16 lg:pt-10`}>
        {/* La foto no pasa del alto de la pantalla: al cargar se ve entera, con el cartel de WhatsApp */}
        <div className="fx-hero-out relative w-full max-w-[min(38rem,calc(100svh-9rem))] max-lg:mx-auto">
          <div className="fx-infuse relative aspect-square overflow-hidden rounded-[2rem] bg-[#f3e9dc] shadow-[0_20px_50px_rgb(43_106_62/0.08)]">
            <Image src={HERO.image} alt={HERO.imageAlt} fill priority sizes="(min-width: 1024px) 620px, 92vw" className="object-cover" />
          </div>
          <p className="fx-pop absolute -bottom-5 left-6 inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-sm font-bold shadow-md">
            <WhatsappLogo size={18} weight="fill" className="text-primary" aria-hidden />
            {HERO.badge}
          </p>
        </div>

        <div className="lg:pl-4">
          <p className="fx-rise inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-sm font-bold text-primary">
            <Leaf size={16} weight="bold" aria-hidden /> {HERO.eyebrow}
          </p>
          <h1 style={{ "--i": 1 } as React.CSSProperties} className="fx-rise mt-6 max-w-xl font-display text-4xl font-extrabold leading-[1.15] text-foreground sm:text-5xl lg:text-[3.15rem]">
            {HERO.titleStart} <span className="text-primary">{HERO.titleHighlight}</span> {HERO.titleEnd}
          </h1>
          <p style={{ "--i": 2 } as React.CSSProperties} className="fx-rise mt-6 max-w-xl leading-relaxed text-muted lg:text-[1.05rem]">{HERO.text}</p>
          <div style={{ "--i": 3 } as React.CSSProperties} className="fx-rise mt-8 flex flex-wrap gap-3">
            <Link href="/tienda" className={btnPrimary}>
              Ver tienda <ArrowRight size={18} weight="bold" aria-hidden />
            </Link>
            <Link href="/#ofertas" className={btnOutline}>
              Ver productos
            </Link>
          </div>
          <svg className="fx-draw mt-9 h-7 w-40 text-primary/60" viewBox="0 0 150 24" fill="none" aria-hidden>
            <path d="M2 14c16-12 34-12 52 0s38 12 56 0 28-10 38-4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </section>
  );
}

function Categories({ categories }: { categories: PublicCategory[] }) {
  if (categories.length === 0) return null;
  return (
    <section className={`${container} mt-20`}>
      <div className="fx-pour relative overflow-hidden rounded-[2.5rem] bg-primary px-5 pb-8 pt-9 sm:px-10">
        <span className="pointer-events-none absolute -left-20 -top-20 size-72 rounded-full bg-white/[0.06]" aria-hidden />
        <span className="pointer-events-none absolute -bottom-28 -right-20 size-80 rounded-full bg-white/[0.06]" aria-hidden />
        <div className="relative">
          <CaretDoubleDown size={18} weight="bold" className="mx-auto mb-1 text-white/70" aria-hidden />
          <SectionHeading title={SECTIONS.categories.title} text={SECTIONS.categories.text} light compact />
          <CategoryCarousel categories={categories} />
        </div>
      </div>
    </section>
  );
}

const BENEFIT_ICONS = { cart: ShoppingCartSimple, whatsapp: WhatsappLogo, chat: ChatCircleDots, store: Storefront };

function BenefitsCard() {
  return (
    <div id="como-comprar" className="flex w-full scroll-mt-28 flex-col rounded-[var(--radius-card)] bg-primary p-6 text-white">
      <h3 className="font-display text-[1.4rem] font-bold leading-tight">{BENEFITS.title}</h3>
      <ul className="mt-5 grid grid-cols-2 gap-3">
        {BENEFITS.items.map(({ icon, text }) => {
          const Icon = BENEFIT_ICONS[icon];
          return (
            <li
              key={text}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-surface px-2 py-4 text-center text-[0.8rem] font-bold leading-snug text-foreground"
            >
              <Icon size={24} className="text-primary" aria-hidden />
              {text}
            </li>
          );
        })}
      </ul>
      <Link
        href="/tienda"
        className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-white/35 px-5 py-2.5 font-bold transition-colors hover:bg-white hover:text-primary"
      >
        <CaretRight size={16} weight="bold" aria-hidden /> Conocé más
      </Link>
    </div>
  );
}

/** Hasta 3 productos y la tarjeta de beneficios, en 4 columnas iguales (centradas si hay menos). */
function Offers({ heading, products }: { heading: SectionHeadingProps; products: PublicProduct[] }) {
  const item = "w-full sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-4.5rem)/4)]";
  return (
    <section id="ofertas" className={`${container} mt-24 scroll-mt-28`}>
      {products.length > 0 && <SectionHeading {...heading} />}
      <div className="flex flex-wrap justify-center gap-6">
        {products.map((p, i) => (
          <div key={p.id} style={{ "--i": i } as React.CSSProperties} className={`fx-deal flex ${item}`}>
            <ProductCard product={p} />
          </div>
        ))}
        <div className={`fx-flip flex ${item}`}>
          <BenefitsCard />
        </div>
      </div>
    </section>
  );
}

function Ritual({ combosHref }: { combosHref: string }) {
  const photo = "relative aspect-square w-1/2 max-w-60 overflow-hidden rounded-[1.75rem] bg-[#f3e6d3] shadow-[0_14px_30px_rgb(120_84_40/0.12)]";
  return (
    <section className={`${container} relative isolate mt-24`}>
      {/* Recuadro cálido difuso arriba a la derecha, como en el diseño */}
      <span
        className="pointer-events-none absolute -top-8 right-4 -z-10 size-72 rounded-[3rem] bg-gradient-to-bl from-[#f3e4d0] via-[#f6ecdf]/50 to-transparent blur-lg sm:right-6"
        aria-hidden
      />
      <div className="grid items-center gap-12 py-6 lg:grid-cols-2">
        <div className="flex items-center justify-center gap-3 px-2 sm:gap-4" aria-hidden>
          <div className={`${photo} fx-split-a -rotate-[5deg] translate-y-3`}>
            <Image src="/landing/ritual-yerba.jpg" alt="" fill sizes="(min-width: 640px) 240px, 45vw" className="object-cover" />
          </div>
          <div className={`${photo} fx-split-b rotate-[3deg]`}>
            <Image src="/landing/ritual-termos.jpg" alt="" fill sizes="(min-width: 640px) 240px, 45vw" className="object-cover" />
          </div>
        </div>
        <div className="px-2">
          <h2 className="font-display text-3xl font-bold leading-tight sm:text-[2.6rem] sm:leading-[1.2]">
            {SECTIONS.ritual.title}
            <br />
            <span className="marker fx-marker">{SECTIONS.ritual.titleBreak}</span>
          </h2>
          <p className="mt-5 max-w-[29rem] text-[1.05rem] leading-relaxed text-muted">{SECTIONS.ritual.text}</p>
          <Link href={combosHref} className={`${btnPrimary} mt-8`}>
            <Gift size={18} weight="bold" aria-hidden /> Ver combos
          </Link>
        </div>
      </div>
    </section>
  );
}

function Promos({ bombillasHref, combosHref }: { bombillasHref: string; combosHref: string }) {
  return (
    <section className={`${container} mt-24 grid gap-6 lg:grid-cols-2`}>
      <PromoCard
        dark
        className="fx-from-left"
        {...SECTIONS.promoBombillas}
        href={bombillasHref}
        cta="Ver bombillas"
        image="/landing/promo-bombillas.svg"
      />
      <PromoCard className="fx-from-right" {...SECTIONS.promoCombos} href={combosHref} cta="Ver combos" image="/landing/promo-combos.svg" />
    </section>
  );
}

/** Tarjeta de promo: texto a la izquierda e ilustración a la derecha (SVG livianos en public/landing). */
function PromoCard({
  title,
  text,
  href,
  cta,
  image,
  dark = false,
  className = "",
}: {
  title: string;
  text: string;
  href: string;
  cta: string;
  image: string;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`${className} flex flex-col-reverse items-center gap-6 rounded-[2rem] p-8 text-center sm:flex-row sm:p-10 sm:text-left ${
        dark ? "bg-primary-deep text-white" : "bg-[#f1e7d8] text-foreground"
      }`}
    >
      <div className="flex-1">
        <h2 className="font-display text-2xl font-bold leading-tight sm:text-[1.75rem]">{title}</h2>
        <p className={`mt-3 ${dark ? "text-white/85" : "text-muted"}`}>{text}</p>
        <Link
          href={href}
          className={`mt-6 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 font-bold transition-colors ${
            dark ? "bg-background text-primary-deep hover:bg-white" : "bg-primary-deep text-white hover:bg-primary"
          }`}
        >
          {cta} <CaretRight size={16} weight="bold" aria-hidden />
        </Link>
      </div>
      <Image src={image} alt="" width={240} height={240} unoptimized className="fx-stir size-40 shrink-0 sm:size-44" />
    </div>
  );
}
