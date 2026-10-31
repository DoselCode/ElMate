/**
 * Textos fijos de la web pública que no se editan desde el panel. Los de la portada y las secciones de la home
 * viven en shared/home-content.ts (con su valor por defecto) y se cambian desde "Textos de la web".
 * Los datos del local (WhatsApp, dirección, redes, horarios) se cargan desde el panel ("Datos del local");
 * FOOTER_PLACEHOLDER solo completa el footer mientras esos datos estén vacíos.
 *
 * Revisar con el cliente: los beneficios describen cómo se compra; no prometen envíos ni plazos.
 */

/** Imagen de la portada. Los textos de la home se editan desde el panel (shared/home-content.ts). */
export const HERO = {
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
