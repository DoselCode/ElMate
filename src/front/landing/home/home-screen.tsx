import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CaretDoubleDown,
  CaretRight,
  InstagramLogo,
  PencilSimpleLine,
  ChatCircleDots,
  Gift,
  ShoppingCartSimple,
  Storefront,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import type { HomeData, PublicCategory, PublicProduct, PublicPromotion } from "@/shared/types";
import { ProductGrid } from "../catalog/product-card";
import { t } from "@/shared/home-content";
import { BENEFITS, HERO, INSTAGRAM_POSTS, INSTAGRAM_URL } from "../content";
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

/** Título, etiqueta y texto de una sección (ver shared/home-content.ts). */
const heading = (id: "featured" | "offers" | "instagram"): SectionHeadingProps => ({
  eyebrow: t(`${id}.eyebrow`),
  title: t(`${id}.title`),
  text: t(`${id}.text`),
});

export function HomeScreen({ data, categories, promotions }: { data: HomeData; categories: PublicCategory[]; promotions: PublicPromotion[] }) {
  // Destacados; si todavía no hay ninguno, los más vendidos para que la sección no quede vacía
  const highlighted = data.featured.length > 0 ? data.featured : data.bestSellers;
  return (
    <>
      <Hero />
      {/* Se alternan secciones de listado (productos, categorías) con las que no lo son (ritual, grabado, promos) */}
      <ProductSection id="ofertas" heading={heading("offers")} products={data.offers.slice(0, 4)} />
      <PromoCards promotions={promotions.filter((p) => p.show_card)} />
      <Categories categories={categories} />
      <Ritual combosHref={categoryHref(categories, "combo")} />
      <ProductSection id="destacados" heading={heading("featured")} products={highlighted.slice(0, 8)} />
      <Engraving href={categoryHref(categories, "grabado")} />
      <Instagram />
    </>
  );
}

const dateFormat = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" });

/** Cards de promociones vigentes (fecha especial, Cyber Monday…): se cargan en el panel y salen solas entre sus fechas. */
function PromoCards({ promotions }: { promotions: PublicPromotion[] }) {
  if (promotions.length === 0) return null;
  return (
    <section id="promociones" className={`${container} mt-12 grid scroll-mt-28 gap-6 ${promotions.length > 1 ? "lg:grid-cols-2" : ""}`}>
      {promotions.slice(0, 2).map((promo, i) => (
        <article
          key={promo.id}
          style={{ "--i": i } as React.CSSProperties}
          className="fx-vapor flex flex-col items-start gap-4 rounded-[2rem] bg-primary-deep p-8 text-white sm:p-10"
        >
          <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-bold">
            <Gift size={16} weight="bold" aria-hidden />
            {promo.ends_at ? `Hasta el ${dateFormat.format(new Date(promo.ends_at))}` : "Promo vigente"}
          </p>
          <h2 className="font-display text-3xl font-bold leading-tight sm:text-[2.2rem]">{promo.card_title || promo.name}</h2>
          {(promo.card_text || promo.description) && <p className="max-w-xl text-white/85">{promo.card_text || promo.description}</p>}
          <Link
            href={`/tienda?promo=${promo.slug}`}
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-bold text-primary-deep transition-colors hover:bg-primary-soft"
          >
            {promo.card_cta || "Ver promo"} <ArrowRight size={18} weight="bold" aria-hidden />
          </Link>
        </article>
      ))}
    </section>
  );
}

/** Invitación al grabado personalizado: lleva a los productos que se pueden grabar. */
function Engraving({ href }: { href: string }) {
  return (
    <section id="grabado" className={`${container} mt-24 scroll-mt-28`}>
      <div className="fx-vapor grid items-center gap-8 rounded-[2rem] bg-surface p-8 sm:p-12 lg:grid-cols-[auto_1fr_auto]">
        <span className="grid size-20 place-items-center rounded-full bg-primary-soft text-primary" aria-hidden>
          <PencilSimpleLine size={40} weight="duotone" />
        </span>
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.15em] text-primary">{t("engraving.eyebrow")}</p>
          <h2 className="mt-2 font-display text-2xl font-bold leading-tight sm:text-[2rem]">{t("engraving.title")}</h2>
          <p className="mt-3 max-w-2xl text-muted">{t("engraving.text")}</p>
        </div>
        <Link href={href} className={btnPrimary}>
          Ver productos <ArrowRight size={18} weight="bold" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

function Instagram() {
  if (INSTAGRAM_POSTS.length === 0) return null;
  return (
    <section id="instagram" className={`${container} mt-24 scroll-mt-28`}>
      <SectionHeading {...heading("instagram")} />
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
        {INSTAGRAM_POSTS.slice(0, 6).map((post, i) => (
          <li key={post.url} style={{ "--i": i } as React.CSSProperties} className="fx-vapor">
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block aspect-square overflow-hidden rounded-2xl bg-primary-soft"
            >
              <Image src={post.image} alt={post.alt} fill sizes="(min-width: 1024px) 14vw, (min-width: 768px) 30vw, 45vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
              <span className="absolute inset-0 grid place-items-center bg-primary-deep/0 text-white opacity-0 transition group-hover:bg-primary-deep/50 group-hover:opacity-100">
                <InstagramLogo size={32} weight="bold" aria-hidden />
              </span>
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-8 text-center">
        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className={btnOutline}>
          <InstagramLogo size={18} weight="bold" aria-hidden /> Ver más en Instagram
        </a>
      </div>
    </section>
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
          <div className="fx-infuse relative aspect-square overflow-hidden rounded-[2rem] bg-primary-deep shadow-[0_20px_50px_rgb(11_17_25/0.14)]">
            <HeroBrew label={HERO.imageAlt} />
          </div>
          <p className="fx-pop absolute -bottom-5 left-6 inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-sm font-bold shadow-md">
            <WhatsappLogo size={18} weight="fill" className="text-primary" aria-hidden />
            {t("hero.badge")}
          </p>
        </div>

        <div className="lg:pl-4">
          <h1 style={{ "--i": 1 } as React.CSSProperties} className="fx-rise max-w-xl font-display text-4xl font-extrabold leading-[1.15] text-foreground sm:text-5xl lg:text-[3.15rem]">
            {t("hero.titleStart")} <span className="text-primary">{t("hero.titleHighlight")}</span> {t("hero.titleEnd")}
          </h1>
          <p style={{ "--i": 2 } as React.CSSProperties} className="fx-rise mt-6 max-w-xl leading-relaxed text-muted lg:text-[1.05rem]">{t("hero.text")}</p>
          <div style={{ "--i": 3 } as React.CSSProperties} className="fx-rise mt-8 flex flex-wrap gap-3">
            {/* prefetch: en producción la tienda ya está cargada cuando se hace clic */}
            <Link href="/tienda" prefetch className={btnPrimary}>
              Ver tienda <ArrowRight size={18} weight="bold" aria-hidden />
            </Link>
            <Link href="/#destacados" className={btnOutline}>
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

const BENEFIT_ICONS = { cart: ShoppingCartSimple, whatsapp: WhatsappLogo, chat: ChatCircleDots, store: Storefront };

/** Beneficios de comprar: en columna junto a las categorías en escritorio; apilada y en fila en pantallas chicas. */
function BenefitsCard() {
  return (
    <div
      id="como-comprar"
      className="flex w-full scroll-mt-28 flex-col justify-between gap-5 rounded-[var(--radius-card)] bg-primary p-6 text-white sm:p-8 lg:p-6"
    >
      <h3 className="font-display text-[1.5rem] font-bold leading-tight">{BENEFITS.title}</h3>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
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
        className="inline-flex items-center justify-center gap-1.5 self-start rounded-full border-2 border-white/35 px-5 py-2.5 font-bold transition-colors hover:bg-white hover:text-primary"
      >
        <CaretRight size={16} weight="bold" aria-hidden /> Conocé más
      </Link>
    </div>
  );
}

/** Categorías a la izquierda y la card de beneficios al lado (debajo en pantallas chicas). */
function Categories({ categories }: { categories: PublicCategory[] }) {
  return (
    <section id="categorias" className={`${container} mt-24 scroll-mt-28`}>
      <div className={categories.length > 0 ? "grid items-stretch gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]" : ""}>
        {categories.length > 0 && (
          <div className="fx-pour relative min-w-0 px-1 sm:px-4">
            <CaretDoubleDown size={18} weight="bold" className="mx-auto mb-1 text-primary/70" aria-hidden />
            <SectionHeading title={t("categories.title")} text={t("categories.text")} compact />
            <CategoryCarousel categories={categories} />
          </div>
        )}
        <div className="fx-vapor flex">
          <BenefitsCard />
        </div>
      </div>
    </section>
  );
}

/** Sección con título y hasta 8 productos en grilla. Sin productos no se muestra. */
function ProductSection({ id, heading, products }: { id: string; heading: SectionHeadingProps; products: PublicProduct[] }) {
  if (products.length === 0) return null;
  return (
    <section id={id} className={`${container} mt-24 scroll-mt-28`}>
      <SectionHeading {...heading} />
      <ProductGrid products={products} reveal />
    </section>
  );
}

function Ritual({ combosHref }: { combosHref: string }) {
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
            {t("ritual.title")}
            <br />
            <span className="marker fx-marker">{t("ritual.titleBreak")}</span>
          </h2>
          <p className="mt-5 max-w-[29rem] text-[1.05rem] leading-relaxed text-muted">{t("ritual.text")}</p>
          <Link href={combosHref} className={`${btnPrimary} mt-8`}>
            <Gift size={18} weight="bold" aria-hidden /> Ver combos
          </Link>
        </div>
      </div>
    </section>
  );
}

