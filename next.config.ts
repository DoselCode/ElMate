import type { NextConfig } from "next";

// Las fotos de productos viven en Supabase Storage (bucket público product-images).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
const isDev = process.env.NODE_ENV === "development";

/**
 * Política de contenido: la página solo puede cargar recursos propios, de Supabase (fotos, login y subida)
 * y las publicaciones incrustadas de Instagram. No se puede incrustar la web en otro sitio ni inyectar <base>/<object>.
 * 'unsafe-inline' en script/style es lo que necesita Next sin nonces (con nonces las páginas dejan de cachearse).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${supabaseUrl ? ` ${supabaseUrl.origin}` : ""}`,
  "font-src 'self' data:",
  `connect-src 'self'${supabaseUrl ? ` ${supabaseUrl.origin}` : ""}${isDev ? " ws: wss:" : ""}`,
  "frame-src https://www.instagram.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Solo tiene efecto sobre HTTPS: obliga al navegador a no volver a usar http con este dominio
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // No anunciar qué framework y versión corre
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // El panel y su API nunca se guardan en cachés compartidas ni en el historial del navegador
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
  images: {
    // http y https: las fotos subidas antes de pasar Supabase a https quedaron guardadas con http://
    remotePatterns: supabaseUrl
      ? (["https", "http"] as const).map((protocol) => ({
          protocol,
          hostname: supabaseUrl.hostname,
          port: supabaseUrl.port,
          pathname: "/storage/v1/object/public/**",
        }))
      : [],
    // Supabase local corre en 127.0.0.1; el optimizador bloquea IPs privadas salvo en desarrollo
    dangerouslyAllowLocalIP: isDev,
  },
};

export default nextConfig;
