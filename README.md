# El Mate

Landing + catálogo web + sistema de stock/caja en un solo proyecto.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres + Auth + Storage) · Zod · Vitest.

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Modelo de datos + panel de stock (inventario, variantes, ingresos, ajustes, movimientos) | ✅ |
| 2 | Punto de venta, ventas, caja (arqueo/cierre), ticket | Modelado en la base y probado; falta la interfaz |
| 3 | Web pública (Diseño 2 de Figma): home, tienda, producto, carrito → WhatsApp, "Datos del local" | ✅ probada en modo demo; falta probar contra Supabase |

## Puesta en marcha

1. Crear un proyecto en [Supabase](https://supabase.com).
2. **Authentication → Sign In / Providers → desactivar "Allow new users to sign up"**. Los usuarios los crea el administrador; el primer usuario creado queda como `admin` y los siguientes como `empleado`.
3. Aplicar las migraciones, en orden, desde el SQL Editor (o con la CLI: `supabase link` + `supabase db push`):
   - `supabase/migrations/20261002000000_core_schema.sql`
   - `supabase/migrations/20261002000001_storage.sql`
   - `supabase/migrations/20261002000002_stock_views.sql`
   - `supabase/migrations/20261016000000_web_publica.sql`
   - `supabase/migrations/20261016000001_fix_search_path.sql`
   - `supabase/migrations/20261018000000_lista_de_precios_y_ventas.sql`

   Una migración ya aplicada en la base real no se edita: los cambios van siempre en una migración nueva.
4. Crear el primer usuario en **Authentication → Users → Add user** (con "Auto Confirm"). Será el admin.
5. Copiar `.env.example` a `.env.local` y completar la URL y la clave *publishable* (Project Settings → API).
6. `npm install` y `npm run dev` → web en http://localhost:3000, panel en http://localhost:3000/admin
7. En el panel, **Datos del local**: cargar el WhatsApp de pedidos (sin eso el carrito no puede enviar), contacto, redes y horarios.
8. Opcional, solo desarrollo: `supabase/seed.sql` carga productos de ejemplo. **No usar en producción.**

**Ver la web sin base de datos:** con `ELMATE_DEMO=1` la web pública usa un catálogo de ejemplo en memoria
(en PowerShell: `$env:ELMATE_DEMO='1'; npm run dev`). El panel sigue necesitando Supabase.

## Scripts

```bash
npm run dev        # desarrollo
npm run build      # build de producción
npm run lint
npm run typecheck
npm test           # base de datos (Postgres en memoria) + validaciones
```

Los tests de base de datos corren las migraciones reales sobre [PGlite](https://pglite.dev) con un stub de `auth` y los roles de Supabase, y prueban permisos (admin / empleado / anónimo), stock, ventas, caja y vistas públicas. No hace falta Docker ni internet.

## Cómo está armado

```
supabase/          base de datos: migraciones (tablas, RLS, funciones SQL, vistas) y seed
src/app/           rutas de Next.js: cada página pide datos al back y los dibuja con el front
src/front/         componentes React       → admin/ · landing/ · shared/ (ui y estilos)
src/back/          datos, permisos, acciones → admin/ · landing/ · shared/ (Supabase)
src/shared/        validaciones, tipos y formatos que usan front y back
tests/db/          tests de la base sobre Postgres en memoria
```

Detalle, reglas de qué puede importar qué y dónde va cada cosa nueva: [docs/ESTRUCTURA.md](docs/ESTRUCTURA.md).

### Decisiones de diseño

- **Un producto siempre tiene al menos una variante.** Precio, SKU, código de barras y stock viven en la variante. Las opciones (Color, Tamaño, Material…) son libres, hasta 3 por producto.
- **El stock solo se mueve con `stock_movements`** (inmutable, con saldo resultante y usuario). `product_variants.stock` es una caché mantenida por trigger; ningún rol de la API puede escribirla. Las correcciones son ajustes con motivo.
- **Costos y ganancia solo para admin.** Viven en tablas aparte (`variant_costs`, `sale_item_costs`) con RLS; el empleado recibe `null`.
- **Las operaciones sensibles son funciones SQL transaccionales** (`save_product`, `register_stock_in`, `adjust_stock`, `count_stock`, `create_sale`, `void_sale`, `open/close_cash_session`…). Validan el rol adentro y revocan el acceso a `anon`.
- **Precio único por variante** + recargo/descuento configurable por método de pago (`store_settings.surcharge_*`). **IVA discriminado configurable** (`show_vat`, `vat_rate`).
- **Cajas:** el modelo admite varias (`registers`); la interfaz arrancará con una.
- **Web pública** solo por las vistas `public_*`: sin costos ni cantidades exactas de stock.

### Permisos

| | Admin | Empleado |
|---|---|---|
| Ver inventario, movimientos, ventas | ✅ | ✅ (sin costos) |
| Crear/editar productos, ingresos, ajustes, recuento | ✅ | — |
| Registrar ventas, abrir/cerrar caja | ✅ | ✅ |
| Anular ventas, ver costos y ganancias | ✅ | — |

## Pendiente / a definir

- Alta de empleados desde el panel (hoy se crean en Supabase Auth).
- Interfaz de POS, ventas, caja y ticket (el modelo y las funciones ya existen y están probados).
- Importación del Excel de productos del cliente (las variantes extra se cargan como opciones nuevas).
- Identidad visual de ElMate: hoy se usa la paleta de El Terruño como base; los colores están centralizados en `src/app/globals.css`.
