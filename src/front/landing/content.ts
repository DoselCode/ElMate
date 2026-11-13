/**
 * Textos fijos de la web pública que no se editan desde el panel. Los de la portada y las secciones de la home
 * viven en shared/home-content.ts (con su valor por defecto).
 * Los datos del local (WhatsApp, dirección, redes, horarios) se cargan desde el panel ("Datos del local");
 * FOOTER_PLACEHOLDER solo completa el footer mientras esos datos estén vacíos.
 *
 * Revisar con el cliente: los beneficios describen cómo se compra; no prometen envíos ni plazos.
 */

/** Imagen de la portada. Los textos de la home están en shared/home-content.ts. */
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

/** Perfil de Instagram de la tienda (el de "Datos del local" tiene prioridad en el footer). */
export const INSTAGRAM_URL = "https://www.instagram.com/elmate.cordoba/";

export type InstagramPost = {
  /** Link al posteo en Instagram. */
  url: string;
  /** Imagen en public/landing/instagram/ (ej. "/landing/instagram/posteo-1.jpg"). */
  image: string;
  /** Texto corto para lectores de pantalla. */
  alt: string;
};

/**
 * Últimos posteos, cargados a mano: para actualizarlos, sumar acá el link y la imagen del posteo nuevo
 * (el más reciente primero; la home muestra hasta 6). Con la lista vacía la sección no aparece.
 */
export const INSTAGRAM_POSTS: InstagramPost[] = [];

export type BlogPost = { slug: string; tag: string; title: string; excerpt: string; image: string; body: string[] };

/** Artículos del blog: la home muestra los 3 primeros y cada uno tiene su página en /blog/[slug]. */
export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "como-curar-tu-mate",
    tag: "Ritual",
    title: "Cómo curar tu mate nuevo paso a paso",
    excerpt: "La curada inicial define el sabor para siempre. Te mostramos el método tradicional en 5 simples pasos.",
    image: "/landing/ritual-yerba.jpg",
    body: [
      "Un mate de calabaza o de madera nuevo necesita una curada antes de usarlo: así se sellan los poros, se va el gusto a madera y la yerba no se amarga.",
      "1. Llená el mate con yerba usada y humedecida, hasta el borde.",
      "2. Completá con agua caliente (no hirviendo) y dejalo reposar 24 horas.",
      "3. Al día siguiente, vacialo y raspá con cuidado la pulpa suelta de las paredes con una cuchara.",
      "4. Repetí el proceso uno o dos días más, hasta que el agua salga limpia.",
      "5. Enjuagalo con agua tibia y dejalo secar boca abajo, al aire y lejos del sol.",
      "Después de cada ronda, vacialo y dejalo secar bien: un mate cuidado dura años.",
    ],
  },
  {
    slug: "como-elegir-la-yerba",
    tag: "Yerbas",
    title: "Cómo elegir la yerba perfecta para tu paladar",
    excerpt: "Con palo, despalada, suave o barbacuá: te contamos qué diferencia a cada tipo y cuál te conviene.",
    image: "/landing/hero.jpg",
    body: [
      "No hay una yerba mejor que otra: hay una para cada gusto y cada momento del día.",
      "Con palo: es la más equilibrada. El palo suaviza el sabor y hace que el mate dure más. Ideal para arrancar.",
      "Despalada: más intensa y amarga, para los que buscan un mate con carácter.",
      "Suave: estacionada por más tiempo y con menos polvo, cae bien a cualquier hora.",
      "Barbacuá: secada con humo de leña, tiene un sabor ahumado bien característico.",
      "Si dudás, empezá por una con palo y probá de a poco las demás. En la tienda tenés todas.",
    ],
  },
  {
    slug: "como-cebar-un-buen-mate",
    tag: "Cultura",
    title: "El rito de la ronda: cómo cebar un buen mate",
    excerpt: "La temperatura del agua, el orden de la ronda y los detalles que hacen de cada mate una ceremonia.",
    image: "/landing/ritual-termos.jpg",
    body: [
      "Cebar es un arte y también un gesto: el que ceba cuida la ronda.",
      "Llená tres cuartos del mate con yerba, tapá con la mano, sacudí y dejala inclinada contra una pared.",
      "Mojá el hueco con un chorrito de agua tibia, esperá unos segundos y recién ahí poné la bombilla, sin moverla después.",
      "El agua tiene que estar entre 70 y 80 °C: si hierve, quema la yerba y el mate se lava enseguida.",
      "El primer mate es del cebador. Después, la ronda gira siempre hacia el mismo lado, y el \"gracias\" significa que ya no querés más.",
    ],
  },
];

/**
 * Datos de ejemplo para el footer: se muestran solo en los campos que todavía no se cargaron en "Datos del local".
 * El WhatsApp no tiene ejemplo a propósito: es adonde llegan los pedidos.
 */
export const FOOTER_PLACEHOLDER = {
  tagline: "Tu tienda matera de confianza: mates artesanales, termos, bombillas y las mejores yerbas.",
  address: "Av. Siempre Verde 1234, Local 7 — Buenos Aires",
  phone: "+54 11 5555-1234",
  email: "hola@elmate.com.ar",
  instagram_url: "https://www.instagram.com/elmate.cordoba/",
  facebook_url: "https://www.facebook.com/",
  hours_weekdays: "9 a 19 h",
  hours_saturday: "9 a 13 h",
  hours_sunday: null,
} as const;
