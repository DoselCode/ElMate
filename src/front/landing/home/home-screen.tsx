import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CaretRight,
  InstagramLogo,
  PencilSimpleLine,
  ChatCircleDots,
  Gift,
  ShoppingCartSimple,
  Storefront,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import type { HomeData, PublicCategory, PublicProduct, PublicPromotion, StoreInfo } from "@/shared/types";
import { isInstagramUrl, normalizeInstagramPost } from "@/shared/instagram";
import { badgePct } from "@/shared/pricing";
import { DEFAULT_PROMO_BACKGROUND } from "@/shared/schemas/promotion";
import { ProductGrid } from "../catalog/product-card";
import { makeT, type HomeT } from "@/shared/home-content";
import { BENEFITS, HERO, INSTAGRAM_URL } from "../content";
import { CategoryCarousel } from "./category-carousel";
import { HeroBrew, HeroLetters } from "./hero-brew";
import { InstagramPost } from "./instagram-post";
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

/** Título, etiqueta y texto de una sección (ver shared/home-content.ts; se pueden cambiar desde el panel). */
const heading = (t: HomeT, id: "featured" | "offers" | "instagram"): SectionHeadingProps => ({
  eyebrow: t(`${id}.eyebrow`),
  title: t(`${id}.title`),
  text: t(`${id}.text`),
});

export function HomeScreen({
  data,
  categories,
  promotions,
  store,
  promoShowcase,
}: {
  data: HomeData;
  categories: PublicCategory[];
  promotions: PublicPromotion[];
  store: StoreInfo;
  /** Productos con foto de cada promo con card (por slug), para ilustrarla. */
  promoShowcase: Record<string, PublicProduct[]>;
}) {
  // Destacados; si todavía no hay ninguno, los más vendidos para que la sección no quede vacía
  const highlighted = data.featured.length > 0 ? data.featured : data.bestSellers;
  // Textos de la home: los cargados en "Datos del local" y, si están vacíos, los de shared/home-content.ts
  const t = makeT(store.home_texts);
  return (
    <>
      <Hero t={t} video={store.hero_video} />
      {/* Primero lo urgente (promos de temporada y ofertas), después se alternan listados (categorías, productos) con secciones de contenido (ritual, grabado) */}
      <PromoCards promotions={promotions.filter((p) => p.show_card)} showcase={promoShowcase} fallback={data.offers} />
      <ProductSection id="ofertas" heading={heading(t, "offers")} products={data.offers.slice(0, 4)} />
      <Categories t={t} categories={categories} />
      <ProductSection id="destacados" heading={heading(t, "featured")} products={highlighted.slice(0, 8)} />
      <Ritual t={t} combosHref={categoryHref(categories, "combo")} />
      <Engraving t={t} href={categoryHref(categories, "grabado")} />
      <Instagram t={t} posts={store.instagram_posts} profileUrl={store.instagram_url && isInstagramUrl(store.instagram_url) ? store.instagram_url : INSTAGRAM_URL} />
    </>
  );
}

const dateFormat = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" });

/** Cards de promociones vigentes (fecha especial, Cyber Monday…): se cargan en el panel y salen solas entre sus fechas. */
function PromoCards({
  promotions,
  showcase,
  fallback,
}: {
  promotions: PublicPromotion[];
  showcase: Record<string, PublicProduct[]>;
  /** Si la promo no tiene productos con foto, se ilustra con los productos en oferta. */
  fallback: PublicProduct[];
}) {
  if (promotions.length === 0) return null;
  return (
    <section id="promociones" className={`${container} mt-12 grid scroll-mt-28 gap-6 ${promotions.length > 1 ? "lg:grid-cols-2" : ""}`}>
      {promotions.slice(0, 2).map((promo, i) => (
        <article
          key={promo.id}
          style={{ "--i": i } as React.CSSProperties}
          className="fx-vapor relative isolate grid items-center gap-6 overflow-hidden rounded-[2rem] bg-primary-deep p-8 text-white sm:grid-cols-[minmax(0,1fr)_auto] sm:p-10"
        >
          {/* Fondo configurable desde el panel (o el de por defecto), oscurecido para que el texto se lea */}
          <Image
            src={promo.card_image || DEFAULT_PROMO_BACKGROUND}
            alt=""
            fill
            sizes={promotions.length > 1 ? "(min-width: 1024px) 50vw, 100vw" : "100vw"}
            className="-z-10 object-cover"
          />
          <span className="absolute inset-0 -z-10 bg-gradient-to-r from-primary-deep/95 via-primary-deep/80 to-primary-deep/45" aria-hidden />
          <div className="flex flex-col items-start gap-4">
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
          </div>
          <PromoCollage
            href={`/tienda?promo=${promo.slug}`}
            name={promo.card_title || promo.name}
            products={showcase[promo.slug]?.length ? showcase[promo.slug] : fallback.filter((p) => p.images.length > 0).slice(0, 4)}
          />
        </article>
      ))}
    </section>
  );
}

/** Fotos de los productos de la promo (con su % de descuento), como collage a la derecha de la card. */
function PromoCollage({ href, name, products }: { href: string; name: string; products: PublicProduct[] }) {
  if (products.length === 0) {
    return (
      <span className="hidden size-36 place-items-center rounded-3xl bg-white/10 text-white/80 sm:grid" aria-hidden>
        <Gift size={64} weight="duotone" />
      </span>
    );
  }
  const single = products.length === 1;
  return (
    <Link href={href} className={`grid gap-2.5 ${single ? "w-44 grid-cols-1 sm:w-52" : "grid-cols-2 sm:w-60"}`}>
      {/* Hidden prefix instead of aria-label: the accessible name must keep the visible "−22%" (WCAG 2.5.3) */}
      <span className="sr-only">Ver los productos de {name}:</span>
      {products.map((p, i) => {
        const pct = badgePct(p.discount_pct);
        return (
          <span
            key={p.id}
            className={`relative aspect-square overflow-hidden rounded-2xl bg-white/10 shadow-lg ring-2 ring-white/30 transition-transform hover:scale-[1.03] ${i % 2 === 0 ? "-rotate-2" : "rotate-2"}`}
          >
            <Image src={p.images[0]} alt={p.name} fill sizes="(min-width: 640px) 120px, 45vw" className="object-cover" />
            {pct ? (
              <span className="absolute left-1.5 top-1.5 rounded-full bg-white px-2 py-0.5 text-xs font-extrabold text-primary-deep">
                −{pct}%
              </span>
            ) : null}
          </span>
        );
      })}
    </Link>
  );
}

/** Invitación al grabado personalizado: lleva a los productos que se pueden grabar. */
function Engraving({ t, href }: { t: HomeT; href: string }) {
  return (
    <section id="grabado" className={`${container} mt-24 scroll-mt-28`}>
      <div className="fx-vapor relative isolate grid items-center gap-8 overflow-hidden rounded-[2rem] bg-surface p-8 sm:p-12 lg:grid-cols-[auto_1fr_auto]">
        {/* Fondo: virola de alpaca cincelada (foto real), fundida con la tarjeta para que el texto se lea */}
        {/* En pantallas grandes la foto ocupa la mitad derecha; en celulares, toda la tarjeta (más tapada) */}
        <div className="absolute inset-0 -z-10 lg:left-auto lg:w-1/2" aria-hidden>
          <Image src="/landing/grabado-fondo.jpg" alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover object-[center_24%]" />
        </div>
        <span
          className="absolute inset-0 -z-10 bg-surface/85 lg:bg-transparent lg:bg-gradient-to-r lg:from-surface lg:from-50% lg:via-surface/75 lg:via-70% lg:to-surface/5"
          aria-hidden
        />
        <span className="grid size-20 place-items-center rounded-full bg-primary-soft text-primary" aria-hidden>
          <PencilSimpleLine size={40} weight="duotone" />
        </span>
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.15em] text-primary">{t("engraving.eyebrow")}</p>
          <h2 className="mt-2 font-display text-2xl font-bold leading-tight sm:text-[2rem]">{t("engraving.title")}</h2>
          <p className="mt-3 max-w-2xl text-muted">{t("engraving.text")}</p>
        </div>
        <Link href={href} className={btnPrimary}>
          Ver grabados <ArrowRight size={18} weight="bold" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

/** Publicaciones de Instagram incrustadas: se cargan en el panel pegando solo el link de cada una. */
function Instagram({ t, posts: links, profileUrl }: { t: HomeT; posts: string[]; profileUrl: string }) {
  // Solo links que son de una publicación de Instagram: lo demás no se incrusta
  const posts = links.map(normalizeInstagramPost).filter((p): p is string => p !== null);
  if (posts.length === 0) return null;
  return (
    <section id="instagram" className={`${container} mt-24 scroll-mt-28`}>
      <SectionHeading {...heading(t, "instagram")} />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.slice(0, 6).map((post, i) => (
          <li key={post} style={{ "--i": i } as React.CSSProperties} className="fx-vapor">
            <InstagramPost post={post} title={`Publicación ${i + 1} de Instagram`} />
          </li>
        ))}
      </ul>
      <div className="mt-8 text-center">
        <a href={profileUrl} target="_blank" rel="noopener noreferrer" className={btnOutline}>
          <InstagramLogo size={18} weight="bold" aria-hidden /> Ver más en Instagram
        </a>
      </div>
    </section>
  );
}

function Hero({ t, video }: { t: HomeT; video: string | null }) {
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
            {/* Video cargado en "Datos del local": reemplaza el fondo (termo y mate) y las letras del logo
                quedan encima. Sin video, la animación del termo cebando. Con "reducir movimiento", la animación quieta. */}
            {video ? (
              <div className="relative size-full motion-reduce:hidden">
                <video src={video} autoPlay muted loop playsInline aria-label={HERO.imageAlt} className="size-full object-cover" />
                <div className="absolute inset-0">
                  <HeroLetters />
                </div>
              </div>
            ) : null}
            <div className={video ? "hidden size-full motion-reduce:block" : "size-full"}>
              <HeroBrew label={HERO.imageAlt} />
            </div>
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
function Categories({ t, categories }: { t: HomeT; categories: PublicCategory[] }) {
  return (
    <section id="categorias" className={`${container} mt-24 scroll-mt-28`}>
      <div className={categories.length > 0 ? "grid items-stretch gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]" : ""}>
        {categories.length > 0 && (
          <div className="fx-pour relative min-w-0 px-1 sm:px-4">
            {/* Mismo encabezado que Ofertas: "— 🍃 CATEGORÍAS —" y el título debajo */}
            <SectionHeading eyebrow={t("categories.eyebrow")} title={t("categories.title")} text={t("categories.text")} compact />
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

function Ritual({ t, combosHref }: { t: HomeT; combosHref: string }) {
  const photo = "relative aspect-square w-1/2 max-w-60 overflow-hidden rounded-[1.75rem] bg-surface shadow-[0_14px_30px_rgb(11_17_25/0.14)]";
  return (
    <section className={`${container} relative isolate mt-24`}>
      {/* Recuadro cálido difuso arriba a la derecha, como en el diseño */}
      <span
        className="pointer-events-none absolute -top-8 right-4 -z-10 size-72 rounded-[3rem] bg-gradient-to-bl from-[#dbe9f6] via-[#e8f0f8]/50 to-transparent blur-lg sm:right-6"
        aria-hidden
      />
      <div className="grid items-center gap-12 py-6 lg:grid-cols-2">
        {/* Fotos reales: un combo armado (canasto, termo, mate y yerbera) y un mate imperial de algarrobo */}
        <div className="flex items-center justify-center gap-3 px-2 sm:gap-4" aria-hidden>
          <div className={`${photo} fx-split-a -rotate-[5deg] translate-y-3`}>
            <Image src="/landing/ritual-combo.jpg" alt="" fill sizes="(min-width: 640px) 240px, 45vw" className="object-cover" />
          </div>
          <div className={`${photo} fx-split-b rotate-[3deg]`}>
            <Image src="/landing/ritual-mate.jpg" alt="" fill sizes="(min-width: 640px) 240px, 45vw" className="object-cover" />
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
