# Reporte de QA — develop (2026-11-17)

Entorno: Coolify `ElMate / develop` → app `el-mate:develop` (http://u0k9wpc6hc9inleg5jc4h3fb.187.41.122.109.sslip.io), servicio `Base-Develop` healthy.
Alcance de esta corrida: **web pública completa** + login/protección del panel. El resto del panel (stock, ventas, caja, promos) queda pendiente de una sesión de admin.
Casos: [casos-de-uso.md](casos-de-uso.md).

## Resumen

| | Resultado |
|---|---|
| Casos manuales ejecutados | 17 de 17 de la web pública, CU-21 y CU-22 del panel |
| E2E (Playwright, desktop + mobile) | 16 ok · 1 falla (BUG-01, esperado) · 1 omitido (CU-20, faltan credenciales) |
| Bugs | 1 alto · 2 medios · 1 bajo |
| Observaciones | 4 |

## Resultados por caso

| Caso | Resultado | Nota |
|---|---|---|
| CU-01 Home | ⚠️ | Carga bien; muestra BUG-01, BUG-02 y BUG-03. |
| CU-02 Tienda | ✅ | 18 productos, paginado de 12 ("Página 1 de 2"). |
| CU-03 Categoría | ✅ | `?categoria=yerbas` solo muestra yerbas. Categoría inexistente → estado vacío. |
| CU-04 Orden por precio | ✅ | Ascendente y descendente correctos. |
| CU-05 Solo ofertas | ✅ | 4 productos, todos con "Antes / Ahora". |
| CU-06 Búsqueda | ✅ | Coincidencias correctas; sin resultados muestra "No encontramos productos con esos filtros". |
| CU-07 Ficha | ✅ | Precio, precios por forma de pago (efectivo −20 %, transferencia −15 %, 3 cuotas −10 %, 6 cuotas lista) y stock. |
| CU-08 Variantes | ➖ | Ningún producto de develop tiene más de una variante; no se pudo probar. |
| CU-09 Agregar con cantidad | ✅ | Contador "2 productos", total $8.700 (2 × $4.350). |
| CU-10 Editar carrito | ✅ | Quitar el ítem deja "Tu carrito está vacío" y oculta el envío. |
| CU-11 WhatsApp | ✅ | `wa.me/<número>` con "2 × producto — subtotal", total y nombre opcional. |
| CU-12 Persistencia | ✅ | Sobrevive a la recarga (localStorage). |
| CU-13 Sin stock | ✅ | "Sin stock en esta opción" y botón deshabilitado. |
| CU-14 404 | ✅ | `/producto/no-existe` → 404 "Producto no encontrado". |
| CU-15 Contacto | ✅ | Link a WhatsApp del local en el footer. |
| CU-16 Blog | ➖ | No hay posts enlazados en develop. |
| CU-17 Responsive (375 px) | ✅ | Sin scroll horizontal; carrito usable en mobile (E2E mobile ok). |
| CU-21 Login inválido | ✅ | "Email o contraseña incorrectos". |
| CU-22 Ruta protegida | ✅ | `/admin`, `/admin/stock`, `/admin/ventas`, `/admin/caja` → `/admin/login`. |
| CU-20, CU-23…CU-36 | ⏳ | Requieren sesión de admin. |

## Bugs

### BUG-01 · Alta · Oferta con descuento de "-100%"
- **Dónde:** home (Ofertas y Destacados), tienda, ficha de "Aguantadora Suave 500 g".
- **Qué pasa:** precio anterior $4.587,50 → ahora **$22**. El badge muestra **-100%** (99,5 % redondeado).
- **Esperado:** un precio de oferta razonable; nunca un badge de 100 %.
- **Causa probable:** typo al cargar el precio de oferta y el panel no advierte descuentos extremos.
- **Sugerencia:** corregir el dato; en el panel, advertir o bloquear descuentos > 70 %; en `DiscountBadge` (`src/front/landing/catalog/price.tsx`) redondear hacia abajo para que 99,5 % no se muestre como 100 %.
- **E2E:** `e2e/public/home.spec.ts` › "discount badges never show 100% or more" falla mientras exista.

### BUG-02 · Media · Banner de promo con texto basura
- **Dónde:** carrusel del hero de la home, promo "Hasta el 7 de enero".
- **Qué pasa:** título "S", subtítulo "d", descripción "d".
- **Sugerencia:** borrar la promo de prueba; exigir largo mínimo en título/descripción en el formulario de promociones.

### BUG-03 · Media · Productos de prueba visibles al público
- **Dónde:** Destacados y tienda.
- **Qué pasa:** producto **"Test"** (Mates, $36.762,50) y producto **"mate"** sin categoría ($12.222, sin stock).
- **Sugerencia:** desactivar o borrar; exigir categoría al guardar un producto.

### BUG-04 · Baja · Productos sin foto
- Casi todos los productos muestran el placeholder. Es dato, no código, pero en producción afecta la conversión.

## Observaciones

- **OBS-01 · HTTPS:** develop se sirve por HTTP en `sslip.io`; la consola avisa que se ignora el header COOP. Para producción hace falta dominio con HTTPS.
- **OBS-02 · Datos:** develop tiene 18 productos activos, contra los 494 del catálogo. Confirmar si es a propósito.
- **OBS-03 · Healthcheck:** la app en Coolify figura `running:unknown` porque no tiene healthcheck configurado.
- **OBS-04 · Destacados:** se muestran productos sin stock; conviene priorizar los que tienen stock.

## Cómo repetir la corrida E2E

```bash
E2E_BASE_URL=http://u0k9wpc6hc9inleg5jc4h3fb.187.41.122.109.sslip.io npm run test:e2e
```
