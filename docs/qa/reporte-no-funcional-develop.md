# Reporte de pruebas no funcionales — develop (2026-11-17)

Entorno: Coolify `ElMate / develop` (http://u0k9wpc6hc9inleg5jc4h3fb.187.41.122.109.sslip.io).
Alcance: **seguridad**, **rendimiento** y **accesibilidad**. Todo en modo lectura, salvo 23 intentos de login fallidos con un email inexistente para probar el límite de intentos.
Fuera de alcance: carga/estrés y backups (ver "Pendiente").

> Develop corre `origin/develop`, que va 16 commits por delante del `develop` local (incluye "Seguridad: validaciones, cabeceras, límite de intentos y registro seguro"). Lo de abajo describe lo desplegado.

## Resumen

| Área | Estado | Hallazgos |
|---|---|---|
| Seguridad | 🟢 Bien, con 2 puntos a resolver antes de producción | NF-01 sin HTTPS · NF-02 cookie de sesión legible por JS |
| Rendimiento | 🟢 Bueno | LCP 1,0–2,0 s en celular con 4G lenta, CLS 0 · NF-05 fuentes |
| Accesibilidad | 🟢 Bueno, 2 detalles | NF-03 nombre accesible del collage de promos · NF-04 foco al cerrar el buscador |

## Seguridad

| Control | Resultado | Evidencia |
|---|---|---|
| Cabeceras HTTP | ✅ | `Content-Security-Policy` (con `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`), `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`. No expone `X-Powered-By`. |
| Caché de páginas privadas | ✅ | `/admin/login` → `Cache-Control: no-store`; `/tienda` → `private, no-store`. |
| Permisos en Supabase (anónimo) | ✅ | Con la clave `anon` (pública por diseño), las 19 tablas y vistas internas probadas (`products`, `variant_costs`, `sales`, `stock_movements`, `cash_sessions`, `store_settings`, `profiles`…) responden **401 / 42501**. Solo se leen las vistas `public_*`, sin costos y con stock como sí/no. |
| Funciones RPC | ✅ | `revoke execute on all functions … from anon` y permisos por función (`grant … to authenticated`). |
| API pública `/api/buscar` | ✅ | Solo datos de catálogo, sin costos ni stock exacto. Entradas raras (3000 caracteres, `'`, `;`, `%`, `(`) → 200 sin errores, en unos 160 ms. |
| Clave de Supabase en el navegador | ✅ | Solo aparece en el bundle del formulario de producto (subida de fotos) y es la `anon`. No hay `service_role` en el cliente. |
| Límite de intentos de login | ✅ | Desde el intento ~3 en poco tiempo: "Demasiados intentos. Esperá unos minutos y probá de nuevo." |
| Mensaje de login | ✅ | "Email o contraseña incorrectos": no revela si el email existe. |
| Rutas del panel sin sesión | ✅ | Redirigen a `/admin/login` (E2E CU-22). |

### NF-01 · Alta (antes de producción) · Sin HTTPS
- La app y Supabase (`supabasekong-….sslip.io`) se sirven por **HTTP**. `https://` responde 503.
- Impacto: la sesión del panel y las credenciales viajan sin cifrar. El navegador ignora la cabecera HSTS y la COOP por venir de HTTP.
- Sugerencia: dominio propio con certificado (Coolify + Let's Encrypt) para la app **y** para Supabase, y actualizar `NEXT_PUBLIC_SUPABASE_URL` y la CSP.

### NF-02 · Media · Cookie de sesión legible desde JavaScript
- `sb-…-auth-token` aparece en `document.cookie`: no es `HttpOnly`, y sin HTTPS tampoco es `Secure`.
- Es el comportamiento por defecto de `@supabase/ssr`. El riesgo crece porque la CSP permite `script-src 'unsafe-inline'`: un XSS podría robar la sesión.
- Sugerencia: con HTTPS, `Secure` + `SameSite=Lax`. A mediano plazo, una CSP con nonce en lugar de `'unsafe-inline'`.

### Observaciones
- **OBS-NF-1:** las imágenes de producto de develop apuntan al Storage de **otro proyecto de Supabase** (`yazwjcnlaxwwhisltggc.supabase.co`), mientras que la base es la self-hosted de Coolify. Si ese proyecto es producción, develop depende de sus archivos, y lo que se suba desde develop va a un lugar distinto. Confirmar si es intencional.

## Rendimiento

Medido con Playwright: Pixel 7, red 4G lenta (150 ms, 1,6 Mbps) y CPU 4× más lenta, como Lighthouse mobile. Segunda carga con la caché del navegador vacía.

| Página | TTFB | FCP | LCP | CLS | Peticiones | Peso |
|---|---|---|---|---|---|---|
| Home | 197 ms | 1,19 s | **2,00 s** | 0 | 27 | 1,1 MB |
| Tienda | 194 ms | 1,16 s | **2,02 s** | 0 | 38 | 1,0 MB |
| Producto | 197 ms | 1,21 s | **1,21 s** | 0 | 29 | 0,96 MB |
| Login panel | 195 ms | 0,99 s | **0,99 s** | 0 | 18 | 0,65 MB |

Umbrales de Google: LCP bueno ≤ 2,5 s, CLS bueno ≤ 0,1. **Todas en verde.**

- Compresión gzip en HTML y JS; estáticos con `Cache-Control: public, max-age=31536000, immutable`.
- JS transferido de la home: unos **199 KB gzip**.
- Panel (con sesión, respuesta del servidor): stock 370–690 ms, nueva venta 310–570 ms, caja/movimientos/ingresos/promos 150–220 ms. La lentitud de "Editar promoción" (OBS-08 del reporte funcional) **no se reprodujo** (unos 180 ms): fue un arranque en frío.

### NF-05 · Baja · 8 fuentes precargadas (120 KB)
- Cada página precarga 8 archivos `.woff2`. Bajar a las 2–3 variantes que se ven arriba del pliegue (y que el resto cargue con `display: swap`) mejora el FCP en conexiones lentas.

## Accesibilidad

Automatizado con axe-core (WCAG 2.1 A/AA) en desktop y mobile, más una revisión manual de teclado. Spec: `e2e/a11y/accessibility.spec.ts`.

| Página | Resultado |
|---|---|
| Home | ⚠️ NF-03 |
| Tienda | ✅ (solo una advertencia menor: `heading-order`, las tarjetas usan `h3` sin `h2` previo) |
| Producto | ✅ |
| Carrito | ✅ |
| Login panel | ✅ |
| Panel (stock, nueva venta, caja) | ⏳ Spec listo; necesita `E2E_ADMIN_*` |

Teclado (manual):

| Control | Resultado |
|---|---|
| "Saltar al contenido" como primer Tab | ✅ |
| Foco visible | ✅ Contorno de 2–3 px en todos los elementos probados |
| Orden de Tab del header | ✅ Logo → Inicio → Categorías → Tienda → Contacto → Buscar → Carrito |
| Carrito | ✅ El foco va a "Cerrar el carrito", queda dentro del modal, Escape lo cierra y el foco vuelve al botón del carrito |
| Buscador | ⚠️ NF-04 |

### NF-03 · Media · El link del collage de promos no incluye su texto visible
- `PromoCollage` (`src/front/landing/home/home-screen.tsx`, en `origin/develop`) usa `aria-label="Ver los productos de {promo}"`, pero adentro muestra "−22%". Incumple WCAG 2.5.3 (el nombre accesible debe contener el texto visible). Quien usa control por voz no puede activarlo diciendo lo que ve.
- **Corregido en el código (falta desplegar):** se reemplazó el `aria-label` por un prefijo `sr-only`; el nombre queda "Ver los productos de {promo}: … −22%".
- E2E: `e2e/a11y/accessibility.spec.ts` › "home …" falla mientras exista.

### NF-04 · Baja · Al cerrar el buscador con Escape se pierde el foco
- El foco queda en `BODY`, en vez de volver al botón "Buscar productos". Quien navega con teclado tiene que empezar de nuevo desde arriba.
- **Corregido en el código (falta desplegar):** Escape y la X devuelven el foco al botón. E2E: "closing the search panel with Escape returns focus to its toggle".

### Falsos positivos descartados
- **Contraste en las cards de promo (axe: 1,1–1,4:1):** axe midió en plena animación de entrada (blur + fade). Con la animación terminada es texto blanco sobre `rgb(11,17,25)`, con contraste alto. El spec ahora emula `prefers-reduced-motion`, que el CSS respeta.
- **Imágenes sin `alt` en Instagram:** están dentro del iframe de Instagram (contenido de terceros); se excluyen del análisis.

## Pendiente

- **Carga / estrés:** no se corrió porque le pega al servidor de Coolify. Propuesta: 20–50 usuarios virtuales sobre `/`, `/tienda` y `/api/buscar` durante 2–5 minutos, con tu OK y en un horario sin uso.
- **Backups y restauración:** requiere acceso al servidor y a la configuración de Coolify de la base `Base-Develop`.
- **Accesibilidad del panel y rol empleado:** requieren credenciales (`E2E_ADMIN_*`) y un usuario empleado.

## Cómo repetir

```bash
E2E_BASE_URL=http://u0k9wpc6hc9inleg5jc4h3fb.187.41.122.109.sslip.io npx playwright test e2e/a11y
```
