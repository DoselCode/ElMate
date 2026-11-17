# Reporte de QA — develop (2026-11-17)

Entorno: Coolify `ElMate / develop` → app `el-mate:develop` (http://u0k9wpc6hc9inleg5jc4h3fb.187.41.122.109.sslip.io), servicio `Base-Develop` healthy.
Alcance: web pública completa y panel admin (stock, ventas, caja, promociones, datos del local, ingresos) con usuario admin.
Casos: [casos-de-uso.md](casos-de-uso.md).

## Resumen

| | Resultado |
|---|---|
| Casos ejecutados | 32 de 36 (faltan CU-23 como empleado, CU-31, el cierre real de CU-33 y crear una promo en CU-34) |
| E2E (Playwright) | 16 ok · 1 falla (BUG-01, esperado) · 15 omitidos (panel: necesitan `E2E_ADMIN_*` y, los que escriben datos, `E2E_ALLOW_WRITES=1`) |
| Bugs | 2 altos · 3 medios · 1 bajo |
| Observaciones | 8 |

## Resultados por caso

### Web pública

| Caso | Resultado | Nota |
|---|---|---|
| CU-01 Home | ⚠️ | Carga bien; muestra BUG-01, BUG-02 y BUG-03. |
| CU-02 Tienda | ✅ | Paginado de 12 ("Página 1 de 2 · 18 resultados"). |
| CU-03 Categoría | ✅ | Categoría inexistente → estado vacío. |
| CU-04 Orden por precio | ✅ | Ascendente y descendente. |
| CU-05 Solo ofertas | ✅ | |
| CU-06 Búsqueda | ✅ | Sin resultados: "No encontramos productos con esos filtros". |
| CU-07 Ficha | ✅ | Precios por forma de pago correctos. |
| CU-08 Variantes | ✅ | En "Test", elegir Rojo cambia la etiqueta y el carrito guarda "Test / Rojo". |
| CU-09 a CU-12 Carrito y WhatsApp | ✅ | Cantidad, total, quitar, persistencia y mensaje `wa.me` con nombre opcional. |
| CU-13 Sin stock | ✅ | Botón deshabilitado. |
| CU-14 404 | ✅ | |
| CU-15 Contacto | ✅ | |
| CU-16 Blog | ➖ | No hay posts enlazados en develop. |
| CU-17 Responsive | ✅ | Sin scroll horizontal en 375 px. |

### Panel

| Caso | Resultado | Nota |
|---|---|---|
| CU-20 Login | ✅ | Manual (lo hizo el usuario). E2E listo, omitido sin credenciales. |
| CU-21 Login inválido | ✅ | "Email o contraseña incorrectos". |
| CU-22 Ruta protegida | ✅ | Redirige a `/admin/login`. |
| CU-23 Ver stock | ✅ admin / ⏳ empleado | Admin ve costos. No hay usuario empleado para probar que no los vea. |
| CU-24 Crear producto | ❌ / ✅ | **Con SKU automático falla (BUG-05).** Con SKU manual se crea; validación y cálculo de precio OK (costo $1.000 + 50 % → efectivo $2.000, lista $2.500). |
| CU-25 Ocultar producto | ✅ | Destildar "Visible en la tienda" lo saca de la web. |
| CU-26 Ingreso | ✅ | Cantidad 0 → "Tiene que ser mayor a 0"; +10 OK. |
| CU-27 Ajuste con motivo | ✅ | "Sumar / restar" sin motivo → "Indicá el motivo"; con motivo, −1 OK. Ver OBS-05. |
| CU-28 Movimientos | ✅ | Tipo, cantidad, saldo, detalle y usuario. |
| CU-29 Caja abierta | ✅ | Ya había una caja abierta desde el 14/11; no se abrió una nueva. |
| CU-30 Venta (POS) | ✅ | 2 × $2.500 por transferencia −15 % = $4.250; ticket N° 4 correcto; stock 9 → 7. |
| CU-31 Venta sin stock | ⏳ | No se probó. |
| CU-32 Anular venta | ✅ | Sin motivo → "Indicá el motivo"; con motivo queda "ANULADA", el stock vuelve (7 → 9) y no suma en caja. |
| CU-33 Caja: retiros / ingresos / arqueo | ✅ parcial | Ingreso +$1.000 y retiro −$1.000 OK; el arqueo calcula bien ("Faltan $2.710"). **No se confirmó el cierre**: la caja abierta no es de esta prueba. |
| CU-34 Promociones | ⚠️ | Se revisó la promo existente: origen de BUG-01 y BUG-02. No se creó una promo nueva. |
| CU-35 Datos del local | ✅ | WhatsApp y horarios coinciden con la web. Ver OBS-06. |
| CU-36 Ingresos | ✅ | Noviembre $39.255 (3 ventas, sin la anulada). |

## Bugs

### BUG-05 · Alta (bloqueante) · No se pueden crear productos con SKU automático
- **Pasos:** Inventario → Nuevo producto → completar nombre, costo y ganancia, dejar "Código (SKU)" vacío → "Crear producto".
- **Qué pasa:** "Ya existe una variante con ese código (SKU)." Se repitió 5 veces seguidas. Con un SKU cargado a mano el producto se crea.
- **Causa probable:** la secuencia `public.sku_seq` de develop quedó atrasada respecto de los SKUs `EM-xxxxx` que ya existen (por ejemplo, datos migrados sin sincronizar la secuencia). En el panel solo se ven `EM-00001`, `EM-00024`, `EM-00025` y `EM-00026`, así que las demás colisiones son con variantes que la vista de stock no muestra. Para confirmarlo hay que mirar la base: `select last_value from sku_seq;` contra `select max(sku) from product_variants where sku like 'EM-%';`.
- **Estado:** corregido en develop el 2026-11-17. `setval` devolvió 26 y un producto nuevo sin SKU se creó como `EM-00027` ("QA E2E SKU automatico", oculto).
- **Corrección:** `supabase/migrations/20261117000000_sku_automatico_sin_choques.sql` adelanta `sku_seq` hasta el mayor código `EM-` existente y hace que `next_sku()` saltee códigos ocupados. Test: `tests/db/schema.test.ts` › "código automático (SKU) con códigos EM- cargados a mano".
- **E2E:** `e2e/admin/stock-and-sales.spec.ts` › "BUG-05 …" (con `E2E_ALLOW_WRITES=1`).

### BUG-01 · Alta · Promoción con precio de $22 (badge "-100%")
- **Origen:** la promo **"Navidad ocn el mate"** (16/11/2026 → 07/01/2027) pone precio promocional **$22** a "Aguantadora Suave 500 g" ($4.587,50), "Bomb. Alpaca Chica con Estribo y Dije" ($15.175) y "Matera Alta de Cuero" ($85.000).
- **Qué pasa:** en la web se ve "Antes $4.587,50 / Ahora $22" con **-100%** (99,5 % redondeado).
- **Badge corregido en el código (falta desplegar):** `badgePct` / `discountPct` (`src/shared/pricing.ts`) limitan el badge a 99 %; el resto de los porcentajes no cambia.
- **Pendiente:** corregir el precio de la promo (dato) y, en el formulario de promociones, advertir o bloquear descuentos > 70 %.
- **E2E:** `e2e/public/home.spec.ts` › "discount badges never show 100% or more" falla mientras exista.

### BUG-02 · Media · Card de promo con texto basura en la home
- **Origen:** misma promo. Título de la card "s", texto "d", botón "d"; descripción "xzxzxzxzxz".
- **Sugerencia:** corregir o borrar la promo; exigir un largo mínimo en título, texto y botón de la card.

### BUG-06 · Media · Productos a $0 activos y vendibles
- **Dónde:** "Aguantadora Despalada 500 g" (stock 10) y "Aguantadora Selección 500 g" (stock 30) tienen precio $0, figuran "Visible" en el panel y se pueden agregar en Nueva venta.
- **Riesgo:** una venta a $0 por error en el mostrador. Además, el panel dice "Visible" pero la web no los muestra, lo que confunde.
- **Sugerencia:** no permitir vender ni marcar visible un producto con precio 0, o pedir confirmación.

### BUG-03 · Media · Productos de prueba visibles al público
- "Test" (Mates, $36.762,50), "mate" (sin categoría, $12.222) y "Malbec Reserva — prueba" (Mates, $1.200, aparece en "También te puede gustar").
- **Sugerencia:** ocultarlos o borrarlos; exigir categoría al guardar.

### BUG-04 · Baja · Productos sin foto
- Casi todos muestran el placeholder.

## Observaciones

- **OBS-01 · HTTPS:** develop se sirve por HTTP; la consola avisa que el header COOP se ignora. Producción necesita dominio con HTTPS.
- **OBS-02 · Catálogo:** el panel tiene 499 variantes activas, pero 485 sin stock. Por eso la web muestra solo 18 productos.
- **OBS-03 · Healthcheck:** la app figura `running:unknown` en Coolify por no tener healthcheck.
- **OBS-04 · Destacados:** se muestran productos sin stock.
- **OBS-05 · Recuento:** en modo "Recuento" el motivo es opcional; `docs/ALCANCE.md` dice "ajustes con motivo obligatorio". Definir si es lo esperado.
- **OBS-06 · Instagram:** en Datos del local el campo Instagram está vacío, pero la home muestra "@ELMATE.CORDOBA". Parece texto fijo.
- **OBS-07 · Centavos:** algunos precios por forma de pago muestran centavos raros (por ejemplo $31.248,13 en transferencia de "Test"), porque la lista base tiene centavos.
- **OBS-08 · Carga lenta:** "Editar promoción" queda en "Cargando…" más de 2 segundos.

## Datos que dejó esta prueba en develop

- Producto **"QA E2E Mate de prueba"** (SKU `QA-E2E-001`), oculto de la web, stock 9.
- Venta **N° 4** por $4.250, **anulada** ("QA E2E venta de prueba").
- En la caja abierta: ingreso +$1.000 y retiro −$1.000 ("QA E2E …"). El efectivo esperado no cambió ($152.710).

## Cómo repetir la corrida E2E

```bash
E2E_BASE_URL=http://u0k9wpc6hc9inleg5jc4h3fb.187.41.122.109.sslip.io npm run test:e2e
```

Con `E2E_ADMIN_EMAIL` y `E2E_ADMIN_PASSWORD` en `.env.local` corren también las pantallas del panel. Si además se agrega `E2E_ALLOW_WRITES=1`, corre el circuito completo de stock y ventas. Ese circuito crea datos: usarlo solo contra develop.
