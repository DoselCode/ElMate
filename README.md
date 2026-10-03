# El Mate

Landing + catálogo web + sistema de stock/caja en un solo proyecto.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres + Auth + Storage) · Zod · Vitest.

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Modelo de datos + panel de stock (inventario, variantes, ingresos, ajustes, movimientos) | ✅ |
| 2 | Punto de venta, ventas, caja (arqueo/cierre), ticket | Modelado en la base y probado; falta la interfaz |
| 3 | Landing y catálogo público (pedido por WhatsApp) | Vistas `public_*` listas; falta la interfaz |

## Puesta en marcha

1. Crear un proyecto en [Supabase](https://supabase.com).
2. **Authentication → Sign In / Providers → desactivar "Allow new users to sign up"**. Los usuarios los crea el administrador; el primer usuario creado queda como `admin` y los siguientes como `empleado`.
3. Aplicar las migraciones, en orden, desde el SQL Editor (o con la CLI: `supabase link` + `supabase db push`):
   - `supabase/migrations/20261002000000_core_schema.sql`
   - `supabase/migrations/20261002000001_storage.sql`
   - `supabase/migrations/20261002000002_stock_views.sql`
4. Crear el primer usuario en **Authentication → Users → Add user** (con "Auto Confirm"). Será el admin.
5. Copiar `.env.example` a `.env.local` y completar la URL y la clave *publishable* (Project Settings → API).
6. `npm install` y `npm run dev` → http://localhost:3000/admin
7. Opcional, solo desarrollo: `supabase/seed.sql` carga productos de ejemplo. **No usar en producción.**

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
supabase/migrations/   modelo de datos, RLS, funciones SQL, vistas
src/proxy.ts           refresca la sesión y manda al login (chequeo optimista)
src/lib/auth.ts        capa de acceso: usuario actual, requireStaff / requireAdmin
src/lib/schemas/       validación Zod compartida entre formulario y servidor
src/app/admin/         login y panel (stock, movimientos, formulario de producto)
```

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
