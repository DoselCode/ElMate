/**
 * Textos de la home (portada y títulos de sección). Son fijos: para cambiarlos se edita este archivo.
 * Cada clave se usa con `t("hero.title...")`, y los encabezados de sección con `heading(id)`.
 */
const TEXTS = {
  "hero.titleStart": "El lugar de los",
  "hero.titleHighlight": "materos",
  "hero.titleEnd": "expertos",
  "hero.text":
    "En nuestra tienda vas a encontrar de todo para tu ronda: mates de calabaza y algarrobo, termos, bombillas de alpaca, las yerbas más ricas y combos armados para regalar.",
  "hero.badge": "Pedí fácil por WhatsApp",

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

  "bestSellers.eyebrow": "Lo más vendido",
  "bestSellers.title": "Ofertas especiales",
  "bestSellers.text": "Los favoritos de la comunidad matera, con precio de ronda.",

  "newest.eyebrow": "Recién llegados",
  "newest.title": "Novedades",
  "newest.text": "Lo último que entró, directo a tu mesa.",

  "promoBombillas.title": "Bombillas de alpaca, el detalle que cambia el mate",
  "promoBombillas.text": "Filtrado perfecto y brillo eterno: las preferidas de los cebadores exigentes.",
  "promoCombos.title": "Combos materos: ahorrá comprando todo junto",
  "promoCombos.text": "Armá tu kit completo y empezá a cebar como un experto.",

  "instagram.eyebrow": "Instagram",
  "instagram.title": "Seguinos en @elmate.cordoba",
  "instagram.text": "Novedades, lanzamientos y regalos materos: lo último que publicamos.",

  "blog.eyebrow": "Blog",
  "blog.title": "Últimos artículos",
  "blog.text": "Trucos, recetas y cultura matera para llevar el rito a otro nivel.",
} as const;

export type HomeTextKey = keyof typeof TEXTS;

export const t = (key: HomeTextKey): string => TEXTS[key];
