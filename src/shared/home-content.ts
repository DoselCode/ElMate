/**
 * Textos de la home que se pueden editar desde el panel ("Textos de la web").
 * Cada campo tiene un texto por defecto; lo que el usuario cambia se guarda en la tabla home_content
 * (jsonb { "hero.titleStart": "…" }) y pisa al default. Si borra un campo, vuelve al default.
 * Esta lista alimenta el formulario del panel y la web pública, así que agregar un campo es sumar una línea.
 */

export type HomeField = { key: string; label: string; default: string; multiline?: boolean; max: number };
export type HomeGroup = { id: string; title: string; description: string; fields: HomeField[] };

export const HOME_GROUPS: HomeGroup[] = [
  {
    id: "hero",
    title: "Portada",
    description: "Lo primero que se ve al entrar. El título se arma con tres partes; la del medio va resaltada en azul.",
    fields: [
      { key: "hero.titleStart", label: "Título: inicio", default: "El lugar de los", max: 40 },
      { key: "hero.titleHighlight", label: "Título: palabra resaltada", default: "materos", max: 30 },
      { key: "hero.titleEnd", label: "Título: final", default: "expertos", max: 40 },
      {
        key: "hero.text",
        label: "Subtítulo",
        default:
          "En nuestra tienda vas a encontrar de todo para tu ronda: mates de calabaza y algarrobo, termos, bombillas de alpaca, las yerbas más ricas y combos armados para regalar.",
        multiline: true,
        max: 300,
      },
      { key: "hero.badge", label: "Cartel sobre la imagen", default: "Pedí fácil por WhatsApp", max: 40 },
    ],
  },
  {
    id: "categories",
    title: "Categorías",
    description: "El carrusel de categorías debajo de la portada.",
    fields: [
      { key: "categories.title", label: "Título", default: "Categorías de productos", max: 60 },
      {
        key: "categories.text",
        label: "Texto",
        default: "Elegí por dónde empezar tu ronda: cada categoría tiene lo mejor del mundo matero.",
        multiline: true,
        max: 200,
      },
    ],
  },
  {
    id: "featured",
    title: "Productos destacados",
    description: "Aparece cuando marcás productos como destacados (se eligen en la edición de cada producto).",
    fields: [
      { key: "featured.eyebrow", label: "Etiqueta chica", default: "Destacados", max: 30 },
      { key: "featured.title", label: "Título", default: "Productos destacados", max: 60 },
      { key: "featured.text", label: "Texto", default: "Lo que más sale para armar tu ronda.", multiline: true, max: 160 },
    ],
  },
  {
    id: "offers",
    title: "Ofertas",
    description: "Productos con precio anterior cargado (se ven tachados).",
    fields: [
      { key: "offers.eyebrow", label: "Etiqueta chica", default: "Ofertas", max: 30 },
      { key: "offers.title", label: "Título", default: "Productos con descuento", max: 60 },
      { key: "offers.text", label: "Texto", default: "Precios de ronda especial.", multiline: true, max: 160 },
    ],
  },
  {
    id: "ritual",
    title: "El ritual del mate",
    description: "El bloque con las fotos de yerba y termos. El título se corta en dos líneas.",
    fields: [
      { key: "ritual.title", label: "Título: primera línea", default: "El ritual del mate,", max: 50 },
      { key: "ritual.titleBreak", label: "Título: segunda línea (resaltada)", default: "más rico que nunca.", max: 50 },
      {
        key: "ritual.text",
        label: "Texto",
        default:
          "Armá tu combo matero: mate, bombilla, termo y yerba juntos, listo para regalar o para estrenar en la próxima ronda.",
        multiline: true,
        max: 240,
      },
    ],
  },
  {
    id: "bestSellers",
    title: "Lo más vendido",
    description: "Los productos que más se vendieron.",
    fields: [
      { key: "bestSellers.eyebrow", label: "Etiqueta chica", default: "Lo más vendido", max: 30 },
      { key: "bestSellers.title", label: "Título", default: "Ofertas especiales", max: 60 },
      {
        key: "bestSellers.text",
        label: "Texto",
        default: "Los favoritos de la comunidad matera, con precio de ronda.",
        multiline: true,
        max: 160,
      },
    ],
  },
  {
    id: "newest",
    title: "Novedades",
    description: "Lo último que cargaste (podés dejar afuera productos desde su edición).",
    fields: [
      { key: "newest.eyebrow", label: "Etiqueta chica", default: "Recién llegados", max: 30 },
      { key: "newest.title", label: "Título", default: "Novedades", max: 60 },
      { key: "newest.text", label: "Texto", default: "Lo último que entró, directo a tu mesa.", multiline: true, max: 160 },
    ],
  },
  {
    id: "promos",
    title: "Promos",
    description: "Las dos tarjetas del final de la home.",
    fields: [
      { key: "promoBombillas.title", label: "Promo 1: título", default: "Bombillas de alpaca, el detalle que cambia el mate", max: 90 },
      {
        key: "promoBombillas.text",
        label: "Promo 1: texto",
        default: "Filtrado perfecto y brillo eterno: las preferidas de los cebadores exigentes.",
        multiline: true,
        max: 160,
      },
      { key: "promoCombos.title", label: "Promo 2: título", default: "Combos materos: ahorrá comprando todo junto", max: 90 },
      {
        key: "promoCombos.text",
        label: "Promo 2: texto",
        default: "Armá tu kit completo y empezá a cebar como un experto.",
        multiline: true,
        max: 160,
      },
    ],
  },
];

export const HOME_FIELDS: HomeField[] = HOME_GROUPS.flatMap((g) => g.fields);
const BY_KEY = new Map(HOME_FIELDS.map((f) => [f.key, f]));

/** Overrides tal como se guardan: solo lo que el usuario cambió. */
export type HomeTexts = Record<string, string>;

/** Deja solo las claves conocidas con texto no vacío (lo demás vuelve al default). Sirve al leer y al guardar. */
export function cleanHomeTexts(raw: unknown): HomeTexts {
  const out: HomeTexts = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const field = BY_KEY.get(key);
    if (!field || typeof value !== "string") continue;
    const text = value.trim().slice(0, field.max);
    if (text && text !== field.default) out[key] = text;
  }
  return out;
}

export type HomeContent = {
  /** Devuelve el texto de un campo: el del usuario o, si no hay, el de por defecto. */
  t: (key: string) => string;
};

export function homeContent(overrides: HomeTexts = {}): HomeContent {
  return { t: (key) => overrides[key] ?? BY_KEY.get(key)?.default ?? "" };
}
