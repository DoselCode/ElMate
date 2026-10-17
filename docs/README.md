# ElMate · Resumen de lo hecho

Landing + catálogo web + sistema de stock/caja en **un solo proyecto**.
Stack: Next.js 16 · TypeScript · Tailwind v4 · Supabase (Postgres, Auth, Storage) · Zod · Vitest.

## Qué se hizo

### 1. Modelo de datos (`supabase/migrations/`)
- **Catálogo con variantes:** un producto siempre tiene al menos una variante; precio, SKU, código de barras y stock viven en la variante. Las opciones (Color, Tamaño, Material…) son libres, hasta 3 por producto.
- **Stock por movimientos inmutables** (`stock_movements`): ingreso, venta, ajuste y anulación, con saldo resultante y usuario. El stock de la variante es una caché que solo toca el trigger.
- **Ventas, caja y ticket** modelados y probados: ventas con precio/costo congelados, recargo por método de pago, IVA configurable, apertura/cierre de caja con arqueo, anulación con devolución de stock.
- **Roles `admin` y `empleado`** con RLS. Los costos y ganancias son solo para admin (tablas aparte).
- **Vistas públicas** (`public_*`) para la web, sin costos ni stock exacto: productos (con precio anterior y % de descuento), variantes, categorías con cantidad de productos y los más vendidos (solo el orden, sin cantidades).
- **Precio anterior** opcional por variante (`compare_at_price`) para mostrar ofertas.
- Funciones SQL transaccionales para toda operación sensible (`save_product`, `register_stock_in`, `adjust_stock`, `count_stock`, `create_sale`, `void_sale`, caja…).

### 2. Panel de stock (`/admin`)
- Login con email y contraseña (Supabase Auth).
- Inventario con búsqueda, filtros (categoría, proveedor, stock bajo/agotado), resumen y paginación.
- Alta y edición de producto con variantes y fotos (se comprimen en el navegador).
- Ingreso de mercadería, ajuste manual y recuento de inventario.
- Historial de movimientos.
- "Precio anterior" por variante en el formulario de producto.
- **Datos del local** (`/admin/local`): WhatsApp de pedidos, contacto, redes y horarios que muestra la web.

### 3. Web pública (Diseño 2 de Figma)
- **Home:** hero, categorías, productos con descuento, cómo comprar, combos, los más elegidos, novedades y banners.
- **Tienda** (`/tienda`): categorías, búsqueda, orden y "solo ofertas"; los filtros viajan en la URL.
- **Producto** (`/producto/[slug]`): fotos, elección de variante (Color, Tamaño…), stock y relacionados.
- **Carrito → WhatsApp:** el cliente arma el pedido (se guarda en su navegador) y lo envía armado al WhatsApp del local. Sin cuentas ni pagos online.
- Marca del diseño (verde mate, Baloo 2 + Nunito) aplicada también al panel. Contraste de colores verificado.
- Lo que el diseño mostraba sin datos reales (estrellas, blog, marcas, contacto inventado) se sacó.
- Páginas cacheadas (se regeneran cada 60 s) y refresco inmediato al guardar desde el panel.
- **Modo demo** (`ELMATE_DEMO=1`): catálogo de ejemplo en memoria para ver la web sin base.

### 4. Estructura del código
- Separado en **front** (componentes) y **back** (datos, permisos, acciones), cada uno dividido en **admin** y **landing**, más `shared/` para lo común. Las páginas de `src/app/` solo enrutan.
- Guía completa: [ESTRUCTURA.md](ESTRUCTURA.md).

### 5. Calidad
- 54 tests: base de datos real en memoria (PGlite) con admin/empleado/anónimo, validaciones, carrito y armado del mensaje de WhatsApp.
- Lint, typecheck y build de producción sin errores.

## Permisos

| | Admin | Empleado |
|---|---|---|
| Ver inventario, movimientos y ventas | ✅ | ✅ (sin costos) |
| Crear/editar productos, ingresos, ajustes | ✅ | — |
| Registrar ventas, abrir/cerrar caja | ✅ | ✅ |
| Anular ventas, ver costos y ganancias | ✅ | — |

## Estado actual

- **Base conectada:** proyecto Supabase `ElMate` (`yazwjcnlaxwwhisltggc`, organización de Vercel), reactivado el 16/10/2026. Tiene aplicadas las 5 migraciones y el usuario `devtest123@gmail.com` es admin.
- La web pública se probó contra la base real (home, tienda, búsqueda y producto). El login, la subida de fotos y guardar "Datos del local" no los probé yo: requieren iniciar sesión.
- Plan gratis de Supabase: máximo 2 proyectos activos **por usuario sumando todas sus organizaciones**. Si un proyecto pasa 7 días sin uso, Supabase lo pausa.
- Pendiente en Supabase: desactivar el registro público y activar "Leaked password protection" (Authentication → Settings).
- Las fotos de los productos se cargan desde el panel; mientras no haya, las tarjetas muestran un fondo de marca. La foto del hero sale del diseño de Figma.

## Próximos pasos

1. Cargar el WhatsApp del local en "Datos del local" (sin eso el carrito no puede enviar pedidos).
2. Crear las categorías (Mates, Termos, Bombillas, Yerbas, Combos) y asignarlas a los productos.
3. Pantalla para administrar categorías (con foto) desde el panel.
4. Interfaz de punto de venta, ventas y caja con ticket (el modelo ya existe).
5. Importar el Excel de productos del cliente.
6. Alta de empleados desde el panel.

## Comandos

```bash
npm run dev         # desarrollo: web en http://localhost:3000, panel en /admin
# Web con datos de ejemplo, sin base (PowerShell):
#   $env:ELMATE_DEMO='1'; npm run dev
npm test            # tests
npm run lint
npm run typecheck
npm run build
```
