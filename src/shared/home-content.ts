/**
 * Textos de la home (portada y títulos de sección). Estos son los textos por defecto: desde el panel
 * (Datos del local → Textos de la web) se puede reemplazar cualquiera; lo que quede vacío usa el de acá.
 * La home los lee con `makeT(store.home_texts)`.
 */
const TEXTS = {
  "hero.titleStart": "El lugar de los",
  "hero.titleHighlight": "materos",
  "hero.titleEnd": "expertos",
  "hero.text":
    "En nuestra tienda vas a encontrar de todo para tu ronda: mates de calabaza y algarrobo, termos, bombillas de alpaca, las yerbas más ricas y combos armados para regalar.",
  "hero.badge": "Pedí fácil por WhatsApp",

  "categories.eyebrow": "Categorías",
  "categories.title": "Categorías de productos",
  "categories.text": "Elegí por dónde empezar tu ronda: cada categoría tiene lo mejor del mundo matero.",

  "featured.eyebrow": "Destacados",
  "featured.title": "Productos destacados",
  "featured.text": "Lo que más sale para armar tu ronda.",

  "offers.eyebrow": "Ofertas",
  "offers.title": "Productos con descuento",
  "offers.text": "Precios de ronda especial.",

  "engraving.eyebrow": "Grabado personalizado",
  "engraving.title": "Hacelo único: grabamos tu mate, termo o bombilla",
  "engraving.text": "Un nombre, una fecha o una frase. Elegí el producto, escribinos qué querés grabar y te lo confirmamos por WhatsApp antes de hacerlo.",

  "ritual.title": "El ritual del mate,",
  "ritual.titleBreak": "más rico que nunca.",
  "ritual.text": "Armá tu combo matero: mate, bombilla, termo y yerba juntos, listo para regalar o para estrenar en la próxima ronda.",

  "instagram.eyebrow": "Instagram",
  "instagram.title": "Seguinos en @elmate.cordoba",
  "instagram.text": "Novedades, lanzamientos y regalos materos: lo último que publicamos.",
} as const;

export type HomeTextKey = keyof typeof TEXTS;
export type HomeT = (key: HomeTextKey) => string;

export const HOME_TEXT_DEFAULTS: Readonly<Record<HomeTextKey, string>> = TEXTS;
export const HOME_TEXT_KEYS = Object.keys(TEXTS) as HomeTextKey[];
export const isHomeTextKey = (key: string): key is HomeTextKey => key in TEXTS;

/** Textos de la home con los cambios cargados en el panel (los vacíos o desconocidos se ignoran). */
export function makeT(overrides: Record<string, unknown> | null | undefined): HomeT {
  return (key) => {
    const custom = overrides?.[key];
    return typeof custom === "string" && custom.trim() !== "" ? custom.trim() : TEXTS[key];
  };
}

/** Textos por defecto (sin cambios del panel). */
export const t: HomeT = makeT(null);

/** Cómo se agrupan y se llaman los textos en el formulario de "Datos del local". */
export const HOME_TEXT_SECTIONS: { title: string; fields: { key: HomeTextKey; label: string; long?: boolean }[] }[] = [
  {
    title: "Portada",
    fields: [
      { key: "hero.badge", label: "Etiqueta sobre la imagen" },
      { key: "hero.titleStart", label: "Título: comienzo" },
      { key: "hero.titleHighlight", label: "Título: palabra resaltada (azul)" },
      { key: "hero.titleEnd", label: "Título: final" },
      { key: "hero.text", label: "Texto", long: true },
    ],
  },
  {
    title: "Secciones",
    fields: [
      { key: "offers.eyebrow", label: "Ofertas: etiqueta" },
      { key: "offers.title", label: "Ofertas: título" },
      { key: "offers.text", label: "Ofertas: texto" },
      { key: "categories.eyebrow", label: "Categorías: etiqueta" },
      { key: "categories.title", label: "Categorías: título" },
      { key: "categories.text", label: "Categorías: texto" },
      { key: "featured.eyebrow", label: "Destacados: etiqueta" },
      { key: "featured.title", label: "Destacados: título" },
      { key: "featured.text", label: "Destacados: texto" },
      { key: "ritual.title", label: "Ritual del mate: título" },
      { key: "ritual.titleBreak", label: "Ritual del mate: título resaltado" },
      { key: "ritual.text", label: "Ritual del mate: texto", long: true },
      { key: "engraving.eyebrow", label: "Grabado: etiqueta" },
      { key: "engraving.title", label: "Grabado: título" },
      { key: "engraving.text", label: "Grabado: texto", long: true },
      { key: "instagram.eyebrow", label: "Instagram: etiqueta" },
      { key: "instagram.title", label: "Instagram: título" },
      { key: "instagram.text", label: "Instagram: texto" },
    ],
  },
];
