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
import { SectionHeading } from "./section-heading";

const container = "mx-auto max-w-[82rem] px-4 sm:px-6";
const btnPrimary =
  "inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-white shadow-sm transition-colors hover:bg-primary-hover";
const btnOutline =
  "inline-flex items-center gap-2 rounded-full border-2 border-primary/25 px-6 py-3 font-bold text-foreground transition-colors hover:border-primary hover:text-primary";

/** Link a una categoría por palabra clave ("combo" → /tienda?categoria=combos), o a la tienda si no existe. */
function categoryHref(categories: PublicCategory[], keyword: string) {
  const c = categories.find((c) => c.slug.includes(keyword));
  return c ? `/tienda?categoria=${c.slug}` : "/tienda";
}

export function HomeScreen({ data, categories }: { data: HomeData; categories: PublicCategory[] }) {
  return (
    <>
      <Hero />
      <Categories categories={categories} />
      <Offers offers={data.offers} />
      <Ritual combosHref={categoryHref(categories, "combo")} />
      {data.bestSellers.length > 0 && (
        <section className={`${container} mt-24`}>
          <SectionHeading {...SECTIONS.bestSellers} />
          <ProductGrid products={data.bestSellers} />
        </section>
      )}
      {data.newest.length > 0 && (
        <section className={`${container} mt-24`}>
          <SectionHeading {...SECTIONS.newest} />
          <ProductGrid products={data.newest} />
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
      <div className={`${container} grid items-center gap-12 pt-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pt-12`}>
        <div className="relative">
          <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-[#f3e9dc] shadow-[0_20px_50px_rgb(43_106_62/0.08)]">
            <Image src={HERO.image} alt={HERO.imageAlt} fill priority sizes="(min-width: 1024px) 620px, 92vw" className="object-cover" />
          </div>
          <p className="absolute -bottom-5 left-6 inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-sm font-bold shadow-md">
            <WhatsappLogo size={18} weight="fill" className="text-primary" aria-hidden />
            {HERO.badge}
          </p>
        </div>

        <div className="lg:pl-4">
          <p className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-sm font-bold text-primary">
            <Leaf size={16} weight="bold" aria-hidden /> {HERO.eyebrow}
          </p>
          <h1 className="mt-6 max-w-xl font-display text-4xl font-extrabold leading-[1.15] text-foreground sm:text-5xl lg:text-[3.15rem]">
            {HERO.titleStart} <span className="text-primary">{HERO.titleHighlight}</span> {HERO.titleEnd}
          </h1>
          <p className="mt-6 max-w-xl leading-relaxed text-muted lg:text-[1.05rem]">{HERO.text}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/tienda" className={btnPrimary}>
              Ver tienda <ArrowRight size={18} weight="bold" aria-hidden />
            </Link>
            <Link href="/#ofertas" className={btnOutline}>
              Ver productos
            </Link>
          </div>
          <svg className="mt-9 h-7 w-40 text-primary/60" viewBox="0 0 150 24" fill="none" aria-hidden>
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
      <div className="relative overflow-hidden rounded-[2.5rem] bg-primary px-5 pb-12 pt-14 sm:px-12">
        <span className="pointer-events-none absolute -left-20 -top-20 size-72 rounded-full bg-white/[0.06]" aria-hidden />
        <span className="pointer-events-none absolute -bottom-28 -right-20 size-80 rounded-full bg-white/[0.06]" aria-hidden />
        <div className="relative">
          <CaretDoubleDown size={20} weight="bold" className="mx-auto mb-2 text-white/70" aria-hidden />
          <SectionHeading title={SECTIONS.categories.title} text={SECTIONS.categories.text} light />
          <CategoryCarousel categories={categories} />
        </div>
      </div>
    </section>
  );
}

const BENEFIT_ICONS = { cart: ShoppingCartSimple, whatsapp: WhatsappLogo, chat: ChatCircleDots, store: Storefront };

function BenefitsCard() {
  return (
    <div id="como-comprar" className="flex scroll-mt-28 flex-col rounded-[var(--radius-card)] bg-primary p-6 text-white">
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

function Offers({ offers }: { offers: PublicProduct[] }) {
  return (
    <section id="ofertas" className={`${container} mt-24 scroll-mt-28`}>
      {offers.length > 0 && <SectionHeading {...SECTIONS.offers} />}
      <div className={`grid gap-6 sm:grid-cols-2 ${offers.length > 0 ? "lg:grid-cols-4" : "mx-auto max-w-sm"}`}>
        {offers.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
        <BenefitsCard />
      </div>
    </section>
  );
}

function Ritual({ combosHref }: { combosHref: string }) {
  return (
    <section className={`${container} relative isolate mt-24`}>
      {/* Mancha cálida difusa detrás del texto, como en el diseño */}
      <span className="pointer-events-none absolute -top-10 right-0 -z-10 size-[30rem] rounded-full bg-[#f1e4d3] blur-3xl" aria-hidden />
      <div className="grid items-center gap-12 py-6 lg:grid-cols-2">
        <div className="relative mx-auto flex h-72 w-full max-w-md items-center justify-center sm:h-80" aria-hidden>
          {/* Dos encuadres de la misma foto: el mate y el termo */}
          <div className="absolute left-2 top-10 size-48 -rotate-6 overflow-hidden rounded-3xl shadow-md sm:size-56">
            <Image src={HERO.image} alt="" fill sizes="400px" className="origin-[22%_78%] scale-[1.7] object-cover" />
          </div>
          <div className="absolute right-2 top-2 size-48 rotate-3 overflow-hidden rounded-3xl shadow-md sm:size-56">
            <Image src={HERO.image} alt="" fill sizes="400px" className="origin-[78%_30%] scale-[1.6] object-cover" />
          </div>
        </div>
        <div className="px-2">
          <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
            {SECTIONS.ritual.title}
            <br />
            {SECTIONS.ritual.titleBreak}
          </h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-muted">{SECTIONS.ritual.text}</p>
          <Link href={combosHref} className={`${btnPrimary} mt-7`}>
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
      <div className="rounded-[2rem] bg-primary-deep p-8 text-white sm:px-10 sm:py-12">
        <h2 className="max-w-[18rem] font-display text-2xl font-bold leading-tight sm:text-[1.75rem]">{SECTIONS.promoBombillas.title}</h2>
        <p className="mt-3 max-w-[19rem] text-white/85">{SECTIONS.promoBombillas.text}</p>
        <Link
          href={bombillasHref}
          className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-background px-5 py-2.5 font-bold text-primary-deep transition-colors hover:bg-white"
        >
          Ver bombillas <CaretRight size={16} weight="bold" aria-hidden />
        </Link>
      </div>
      <div className="rounded-[2rem] p-8 sm:px-10 sm:py-12">
        <h2 className="max-w-[17rem] font-display text-2xl font-bold leading-tight sm:text-[1.75rem]">{SECTIONS.promoCombos.title}</h2>
        <p className="mt-3 max-w-[19rem] text-muted">{SECTIONS.promoCombos.text}</p>
        <Link
          href={combosHref}
          className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-primary-deep px-5 py-2.5 font-bold text-white transition-colors hover:bg-primary"
        >
          Ver combos <CaretRight size={16} weight="bold" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
