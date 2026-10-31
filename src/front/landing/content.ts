/**
 * Textos fijos de la web pública. Están juntos para poder editarlos sin tocar los componentes.
 * Los datos del local (WhatsApp, dirección, redes, horarios) se cargan desde el panel ("Datos del local");
 * FOOTER_PLACEHOLDER solo completa el footer mientras esos datos estén vacíos.
 *
 * Revisar con el cliente: los beneficios describen cómo se compra; no prometen envíos ni plazos.
 */

export const HERO = {
  titleStart: "El lugar de los",
  titleHighlight: "materos",
  titleEnd: "expertos",
  text: "En nuestra tienda vas a encontrar de todo para tu ronda: mates de calabaza y algarrobo, termos, bombillas de alpaca, las yerbas más ricas y combos armados para regalar.",
  badge: "Pedí fácil por WhatsApp",
  image: "/landing/hero.jpg",
  imageAlt: "Un termo cebando agua en un mate con bombilla",
};

// Textos cortos (2 líneas): van en mosaicos chicos de 2×2
export const BENEFITS = {
  title: "Beneficios de comprar en ElMate",
  items: [
    { icon: "cart", text: "Pedido online fácil" },
    { icon: "whatsapp", text: "Confirmás por WhatsApp" },
    { icon: "chat", text: "Atención personalizada" },
    { icon: "store", text: "Retiro o envío a coordinar" },
  ],
} as const;

export const SECTIONS = {
  categories: { title: "Categorías de productos", text: "Elegí por dónde empezar tu ronda: cada categoría tiene lo mejor del mundo matero." },
  offers: { eyebrow: "Ofertas", title: "Productos con descuento", text: "Precios de ronda especial." },
  // Reemplaza a "Ofertas" mientras no haya productos con precio anterior cargado
  featured: { eyebrow: "Destacados", title: "Productos destacados", text: "Lo que más sale para armar tu ronda." },
  ritual: {
    title: "El ritual del mate,",
    titleBreak: "más rico que nunca.",
    text: "Armá tu combo matero: mate, bombilla, termo y yerba juntos, listo para regalar o para estrenar en la próxima ronda.",
  },
  bestSellers: { eyebrow: "Lo más vendido", title: "Ofertas especiales", text: "Los favoritos de la comunidad matera, con precio de ronda." },
  newest: { eyebrow: "Recién llegados", title: "Novedades", text: "Lo último que entró, directo a tu mesa." },
  promoBombillas: {
    title: "Bombillas de alpaca, el detalle que cambia el mate",
    text: "Filtrado perfecto y brillo eterno: las preferidas de los cebadores exigentes.",
  },
  promoCombos: { title: "Combos materos: ahorrá comprando todo junto", text: "Armá tu kit completo y empezá a cebar como un experto." },
};

/**
 * Datos de ejemplo para el footer: se muestran solo en los campos que todavía no se cargaron en "Datos del local".
 * El WhatsApp no tiene ejemplo a propósito: es adonde llegan los pedidos.
 */
export const FOOTER_PLACEHOLDER = {
  tagline: "Tu tienda matera de confianza: mates artesanales, termos, bombillas y las mejores yerbas.",
  address: "Av. Siempre Verde 1234, Local 7 — Buenos Aires",
  phone: "+54 11 5555-1234",
  email: "hola@elmate.com.ar",
  instagram_url: "https://www.instagram.com/",
  facebook_url: "https://www.facebook.com/",
  hours_weekdays: "9 a 19 h",
  hours_saturday: "9 a 13 h",
  hours_sunday: null,
} as const;
