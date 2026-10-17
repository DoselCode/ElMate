# ElMate · Resumen de lo hecho

Landing + catálogo web + sistema de stock/caja en **un solo proyecto**.
Stack: Next.js 16 · TypeScript · Tailwind v4 · Supabase (Postgres, Auth, Storage) · Zod · Vitest.

## Qué se hizo

### 1. Modelo de datos (`supabase/migrations/`)
- **Catálogo con variantes:** un producto siempre tiene al menos una variante; precio, SKU, código de barras y stock viven en la variante. Las opciones (Color, Tamaño, Material…) son libres, hasta 3 por producto.
- **Stock por movimientos inmutables** (`stock_movements`): ingreso, venta, ajuste y anulación, con saldo resultante y usuario. El stock de la variante es una caché que solo toca el trigger.
- **Ventas, caja y ticket** modelados y probados: ventas con precio/costo congelados, ajuste por forma de pago, IVA configurable, apertura/cierre de caja con arqueo, anulación con devolución de stock.
- **Lista de precios del local** (migración `20261018000000`): formas de pago configurables con su ajuste sobre la lista (efectivo −20 %, débito/transferencia/QR −15 %, 3 cuotas −10 %, 6 cuotas = lista), marca, costo + % de ganancia, productos por kg con decimales (granel) y productos sin control de stock (grabados).
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

### 3. Ventas, caja e ingresos (`/admin`)
- **Nueva venta** (`/admin/ventas/nueva`): búsqueda instantánea o lector de código de barras (escanear + Enter), cantidades en kg para granel, descuento, total por cada forma de pago y cobro contra la caja abierta.
- **Caja** (`/admin/caja`): apertura con efectivo inicial (propone lo que quedó al último cierre), arqueo en vivo, retiros e ingresos de efectivo, cierre con diferencia e historial de cierres.
- **Ventas** (`/admin/ventas`): historial por fecha, forma de pago y estado, con totales del período; ticket imprimible (no válido como factura) y anulación (solo admin).
- **Ingresos** (`/admin/ingresos`, solo admin): mes por mes, efectivo / otras formas / total y ganancia. Enero–septiembre 2026 vienen del Excel de ingresos (solo totales).
- **Formas de pago** en "Datos del local": nombre, ajuste %, si es efectivo y orden.
- **Precio de lista calculado:** en el producto se carga costo + % de ganancia y el precio sale como en la lista del local (efectivo = costo ÷ (1 − ganancia), redondeado a $10; lista = efectivo ÷ 0,8). Se puede poner a mano.

### 4. Web pública (Diseño 2 de Figma)
- **Home:** hero, categorías, productos con descuento, cómo comprar, combos, los más elegidos, novedades y banners.
- **Tienda** (`/tienda`): categorías, búsqueda, orden y "solo ofertas"; los filtros viajan en la URL.
- **Producto** (`/producto/[slug]`): fotos, elección de variante (Color, Tamaño…), stock y relacionados.
- **Carrito → WhatsApp:** el cliente arma el pedido (se guarda en su navegador) y lo envía armado al WhatsApp del local. Sin cuentas ni pagos online.
- Marca del diseño (verde mate, Baloo 2 + Nunito) aplicada también al panel. Contraste de colores verificado.
- Lo que el diseño mostraba sin datos reales (estrellas, blog, marcas, contacto inventado) se sacó.
- Páginas cacheadas (se regeneran cada 60 s) y refresco inmediato al guardar desde el panel.
- **Modo demo** (`ELMATE_DEMO=1`): catálogo de ejemplo en memoria para ver la web sin base.

### 5. Estructura del código
- Separado en **front** (componentes) y **back** (datos, permisos, acciones), cada uno dividido en **admin** y **landing**, más `shared/` para lo común. Las páginas de `src/app/` solo enrutan.
- Guía completa: [ESTRUCTURA.md](ESTRUCTURA.md).

### 6. Calidad
- 72 tests: base de datos real en memoria (PGlite) con admin/empleado/anónimo, validaciones, carrito y armado del mensaje de WhatsApp.
- Lint, typecheck y build de producción sin errores.

## Permisos

| | Admin | Empleado |
|---|---|---|
| Ver inventario, movimientos y ventas | ✅ | ✅ (sin costos) |
| Crear/editar productos, ingresos, ajustes | ✅ | — |
| Registrar ventas, abrir/cerrar caja | ✅ | ✅ |
| Anular ventas, ver costos y ganancias | ✅ | — |

## Estado actual

- **Base conectada:** proyecto Supabase `ElMate` (`yazwjcnlaxwwhisltggc`, organización de Vercel), reactivado el 16/10/2026. Tiene aplicadas las 6 migraciones y el usuario `devtest123@gmail.com` es admin.
- **Catálogo real importado (18/10/2026)** desde `LISTA PRODUCTOS SOFTWARE.xlsx` (hoja Hoja1): 494 productos en 14 categorías, 45 proveedores, código del local como SKU, precio de lista calculado con costo y ganancia. Entraron **ocultos en la web y con stock 0**: hay que contar el stock y activarlos. En Hoja1 las columnas MARCA y PROVEEDOR están cruzadas; se importaron invertidas. Sin importar: GRA-005 y BOL-033 (sin costo). 16 productos quedaron con precio $0 porque en el Excel tienen costo 0.
- Los 11 productos de prueba se archivaron (no se borran porque tienen movimientos).
- La web pública se probó contra la base real (home, tienda, búsqueda y producto). El login, la subida de fotos y guardar "Datos del local" no los probé yo: requieren iniciar sesión.
- Plan gratis de Supabase: máximo 2 proyectos activos **por usuario sumando todas sus organizaciones**. Si un proyecto pasa 7 días sin uso, Supabase lo pausa.
- Pendiente en Supabase: desactivar el registro público y activar "Leaked password protection" (Authentication → Settings).
- Las fotos de los productos se cargan desde el panel; mientras no haya, las tarjetas muestran un fondo de marca. La foto del hero sale del diseño de Figma.

## Próximos pasos

1. Cargar el WhatsApp del local en "Datos del local" (sin eso el carrito no puede enviar pedidos).
2. Contar el stock de cada producto (Inventario → Ajustar → Recuento) y activar en la web los que se quieran mostrar.
3. Completar costo de los 16 productos con precio $0 y cargar variantes (colores) donde haga falta.
4. Pantalla para administrar categorías (con foto) y proveedores (contacto) desde el panel.
5. Precios mayoristas / empresariales (hojas EMPRESARIALES y YERBAS X MAYOR del Excel) y presupuestos.
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
