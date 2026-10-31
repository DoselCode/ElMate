import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CaretDoubleDown,
  CaretRight,
  ChatCircleDots,
  Gift,
  ShoppingCartSimple,
  Storefront,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import type { HomeData, PublicCategory, PublicProduct } from "@/shared/types";
import { ProductCard, ProductGrid } from "../catalog/product-card";
import type { HomeContent } from "@/shared/home-content";
import { BENEFITS, HERO } from "../content";
import { CategoryCarousel } from "./category-carousel";
import { HeroBrew } from "./hero-brew";
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

/** Título, etiqueta y texto de una sección, con los textos que el usuario cambió desde el panel. */
const heading = (c: HomeContent, id: string): SectionHeadingProps => ({
  eyebrow: c.t(`${id}.eyebrow`),
  title: c.t(`${id}.title`),
  text: c.t(`${id}.text`),
});

export function HomeScreen({ data, categories, content }: { data: HomeData; categories: PublicCategory[]; content: HomeContent }) {
  const featuredIds = new Set(data.featured.map((p) => p.id));
  return (
    <>
      <Hero content={content} />
      <Categories categories={categories} content={content} />
      {/* Destacados: los que el usuario marcó en el panel */}
      {data.featured.length > 0 && (
        <section id="destacados" className={`${container} mt-24 scroll-mt-28`}>
          <SectionHeading {...heading(content, "featured")} />
          <ProductGrid products={data.featured.slice(0, 8)} reveal />
        </section>
      )}
      {/* Sin productos en oferta se muestran los más vendidos y las novedades, para que la sección no quede vacía */}
      {data.offers.length > 0 ? (
        <Offers heading={heading(content, "offers")} products={data.offers.slice(0, 3)} />
      ) : (
        <Offers
          heading={heading(content, "featured")}
          products={uniqueProducts([...data.bestSellers, ...data.newest]).filter((p) => !featuredIds.has(p.id)).slice(0, 3)}
        />
      )}
      <Ritual combosHref={categoryHref(categories, "combo")} content={content} />
      {data.bestSellers.length > 0 && (
        <section className={`${container} mt-24`}>
          <SectionHeading {...heading(content, "bestSellers")} />
          <ProductGrid products={data.bestSellers} reveal />
        </section>
      )}
      {data.newest.length > 0 && (
        <section className={`${container} mt-24`}>
          <SectionHeading {...heading(content, "newest")} />
          <ProductGrid products={data.newest} reveal />
        </section>
      )}
      <Promos bombillasHref={categoryHref(categories, "bombilla")} combosHref={categoryHref(categories, "combo")} content={content} />
    </>
  );
}

function Hero({ content }: { content: HomeContent }) {
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
          <div className="fx-infuse relative aspect-square overflow-hidden rounded-[2rem] bg-primary-deep shadow-[0_20px_50px_rgb(11_17_25/0.14)]">
            <HeroBrew label={HERO.imageAlt} />
          </div>
          <p className="fx-pop absolute -bottom-5 left-6 inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-sm font-bold shadow-md">
            <WhatsappLogo size={18} weight="fill" className="text-primary" aria-hidden />
            {content.t("hero.badge")}
          </p>
        </div>

        <div className="lg:pl-4">
          <h1 style={{ "--i": 1 } as React.CSSProperties} className="fx-rise max-w-xl font-display text-4xl font-extrabold leading-[1.15] text-foreground sm:text-5xl lg:text-[3.15rem]">
            {content.t("hero.titleStart")} <span className="text-primary">{content.t("hero.titleHighlight")}</span> {content.t("hero.titleEnd")}
          </h1>
          <p style={{ "--i": 2 } as React.CSSProperties} className="fx-rise mt-6 max-w-xl leading-relaxed text-muted lg:text-[1.05rem]">{content.t("hero.text")}</p>
          <div style={{ "--i": 3 } as React.CSSProperties} className="fx-rise mt-8 flex flex-wrap gap-3">
            {/* prefetch: en producción la tienda ya está cargada cuando se hace clic */}
            <Link href="/tienda" prefetch className={btnPrimary}>
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

function Categories({ categories, content }: { categories: PublicCategory[]; content: HomeContent }) {
  if (categories.length === 0) return null;
  return (
    <section className={`${container} mt-20`}>
      <div className="fx-pour relative px-1 sm:px-6">
        <CaretDoubleDown size={18} weight="bold" className="mx-auto mb-1 text-primary/70" aria-hidden />
        <SectionHeading title={content.t("categories.title")} text={content.t("categories.text")} compact />
        <CategoryCarousel categories={categories} />
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

function Ritual({ combosHref, content }: { combosHref: string; content: HomeContent }) {
  const photo = "relative aspect-square w-1/2 max-w-60 overflow-hidden rounded-[1.75rem] bg-surface shadow-[0_14px_30px_rgb(11_17_25/0.14)]";
  return (
    <section className={`${container} relative isolate mt-24`}>
      {/* Recuadro cálido difuso arriba a la derecha, como en el diseño */}
      <span
        className="pointer-events-none absolute -top-8 right-4 -z-10 size-72 rounded-[3rem] bg-gradient-to-bl from-[#dbe9f6] via-[#e8f0f8]/50 to-transparent blur-lg sm:right-6"
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
            {content.t("ritual.title")}
            <br />
            <span className="marker fx-marker">{content.t("ritual.titleBreak")}</span>
          </h2>
          <p className="mt-5 max-w-[29rem] text-[1.05rem] leading-relaxed text-muted">{content.t("ritual.text")}</p>
          <Link href={combosHref} className={`${btnPrimary} mt-8`}>
            <Gift size={18} weight="bold" aria-hidden /> Ver combos
          </Link>
        </div>
      </div>
    </section>
  );
}

function Promos({ bombillasHref, combosHref, content }: { bombillasHref: string; combosHref: string; content: HomeContent }) {
  return (
    <section className={`${container} mt-24 grid gap-6 lg:grid-cols-2`}>
      <PromoCard
        dark
        className="fx-from-left"
        title={content.t("promoBombillas.title")}
        text={content.t("promoBombillas.text")}
        href={bombillasHref}
        cta="Ver bombillas"
        image="/landing/promo-bombillas.svg"
      />
      <PromoCard
        className="fx-from-right"
        title={content.t("promoCombos.title")}
        text={content.t("promoCombos.text")}
        href={combosHref} cta="Ver combos" image="/landing/promo-combos.svg" />
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
        dark ? "bg-primary-deep text-white" : "bg-surface text-foreground"
      }`}
    >
      <div className="flex-1">
        <h2 className="font-display text-2xl font-bold leading-tight sm:text-[1.75rem]">{title}</h2>
        <p className={`mt-3 ${dark ? "text-white/85" : "text-muted"}`}>{text}</p>
        <Link
          href={href}
          className={`mt-6 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 font-bold transition-colors ${
            dark ? "bg-white text-primary-deep hover:bg-primary-soft" : "bg-primary-deep text-white hover:bg-primary"
          }`}
        >
          {cta} <CaretRight size={16} weight="bold" aria-hidden />
        </Link>
      </div>
      <Image src={image} alt="" width={240} height={240} unoptimized className="fx-stir size-40 shrink-0 sm:size-44" />
    </div>
  );
}
