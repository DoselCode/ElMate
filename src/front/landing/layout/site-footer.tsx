import Link from "next/link";
import { Clock, EnvelopeSimple, FacebookLogo, InstagramLogo, MapPin, Phone, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import type { PublicCategory, StoreInfo } from "@/shared/types";
import { normalizeWhatsappNumber } from "@/shared/whatsapp";
import { FOOTER_PLACEHOLDER } from "../content";
import { Logo } from "./logo";

/** Completa con datos de ejemplo lo que todavía no se cargó en "Datos del local". */
function withPlaceholders(info: StoreInfo): StoreInfo {
  const filled = { ...info };
  for (const [key, value] of Object.entries(FOOTER_PLACEHOLDER) as [keyof typeof FOOTER_PLACEHOLDER, string | null][]) {
    if (!filled[key]?.trim()) filled[key] = value;
  }
  return filled;
}

/** Pie de página. Los datos de contacto salen de "Datos del local" (panel); lo vacío se completa con datos de ejemplo. */
export function SiteFooter({ store: info, categories }: { store: StoreInfo; categories: PublicCategory[] }) {
  const store = withPlaceholders(info);
  const whatsapp = normalizeWhatsappNumber(store.whatsapp_number);
  const hours = [
    store.hours_weekdays && `Lun a Vie: ${store.hours_weekdays}`,
    store.hours_saturday && `Sábados: ${store.hours_saturday}`,
    store.hours_sunday && `Domingos: ${store.hours_sunday}`,
  ].filter(Boolean) as string[];

  const socials = [
    store.instagram_url && { href: store.instagram_url, label: "Instagram", Icon: InstagramLogo },
    store.facebook_url && { href: store.facebook_url, label: "Facebook", Icon: FacebookLogo },
    whatsapp && { href: `https://wa.me/${whatsapp}`, label: "WhatsApp", Icon: WhatsappLogo },
    store.email && { href: `mailto:${store.email}`, label: "Email", Icon: EnvelopeSimple },
  ].filter(Boolean) as { href: string; label: string; Icon: typeof InstagramLogo }[];

  const hasContact = store.address || store.phone || store.email || hours.length > 0;

  return (
    <footer id="contacto" className="mt-16 scroll-mt-24 bg-primary-soft">
      <div className="mx-auto grid max-w-[82rem] gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo name={store.name} />
          <p className="mt-4 text-sm leading-relaxed text-muted">
            {store.tagline}
          </p>
          {socials.length > 0 && (
            <ul className="mt-5 flex gap-2">
              {socials.map(({ href, label, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target={href.startsWith("http") ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="grid size-10 place-items-center rounded-full bg-surface text-primary transition-colors hover:bg-primary hover:text-white"
                  >
                    <Icon size={20} aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <FooterColumn title="Categorías">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/tienda?categoria=${c.slug}`} className="hover:text-primary">{c.name}</Link>
            </li>
          ))}
        </FooterColumn>

        <FooterColumn title="Tienda">
          <li><Link href="/tienda" className="hover:text-primary">Todos los productos</Link></li>
          <li><Link href="/tienda?ofertas=1" className="hover:text-primary">Ofertas</Link></li>
          <li><Link href="/tienda?orden=nuevos" className="hover:text-primary">Novedades</Link></li>
          <li><Link href="/#como-comprar" className="hover:text-primary">Cómo comprar</Link></li>
        </FooterColumn>

        {hasContact && (
          <FooterColumn title="Contacto">
            {store.address && <ContactItem Icon={MapPin}>{store.address}</ContactItem>}
            {store.phone && (
              <ContactItem Icon={Phone}>
                <a href={`tel:${store.phone.replace(/[^\d+]/g, "")}`} className="hover:text-primary">{store.phone}</a>
              </ContactItem>
            )}
            {store.email && (
              <ContactItem Icon={EnvelopeSimple}>
                <a href={`mailto:${store.email}`} className="hover:text-primary">{store.email}</a>
              </ContactItem>
            )}
            {hours.length > 0 && (
              <ContactItem Icon={Clock}>
                {hours.map((h) => <span key={h} className="block">{h}</span>)}
              </ContactItem>
            )}
          </FooterColumn>
        )}
      </div>
      <p className="bg-primary px-6 py-4 text-center text-sm font-semibold text-white">
        © {new Date().getFullYear()} {store.name} — Todos los derechos reservados. Hecho con yerba y cariño.
      </p>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <ul className="mt-4 space-y-2.5 text-sm text-muted">{children}</ul>
    </div>
  );
}

function ContactItem({ Icon, children }: { Icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <Icon size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
