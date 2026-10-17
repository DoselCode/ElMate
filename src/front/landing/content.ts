/**
 * Textos fijos de la web pública. Están juntos para poder editarlos sin tocar los componentes.
 * Los datos del local (WhatsApp, dirección, redes, horarios) NO van acá: se cargan desde el panel.
 *
 * Revisar con el cliente: los beneficios describen cómo se compra; no prometen envíos ni plazos.
 */

export const HERO = {
  eyebrow: "Todo para tu rito matero",
  titleStart: "El lugar de los",
  titleHighlight: "materos",
  titleEnd: "expertos",
  text: "En ElMate vas a encontrar de todo para tu ronda: mates de calabaza y algarrobo, termos, bombillas de alpaca, las yerbas más ricas y combos armados para regalar.",
  badge: "Pedí fácil por WhatsApp",
  image: "/landing/hero.jpg",
  imageAlt: "Mate de calabaza con bombilla junto a un termo de acero y yerba",
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
