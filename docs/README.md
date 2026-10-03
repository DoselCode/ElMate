# ElMate · Resumen de lo hecho

Landing + catálogo web + sistema de stock/caja en **un solo proyecto**.
Stack: Next.js 16 · TypeScript · Tailwind v4 · Supabase (Postgres, Auth, Storage) · Zod · Vitest.

## Qué se hizo

### 1. Modelo de datos (`supabase/migrations/`)
- **Catálogo con variantes:** un producto siempre tiene al menos una variante; precio, SKU, código de barras y stock viven en la variante. Las opciones (Color, Tamaño, Material…) son libres, hasta 3 por producto.
- **Stock por movimientos inmutables** (`stock_movements`): ingreso, venta, ajuste y anulación, con saldo resultante y usuario. El stock de la variante es una caché que solo toca el trigger.
- **Ventas, caja y ticket** modelados y probados: ventas con precio/costo congelados, recargo por método de pago, IVA configurable, apertura/cierre de caja con arqueo, anulación con devolución de stock.
- **Roles `admin` y `empleado`** con RLS. Los costos y ganancias son solo para admin (tablas aparte).
- **Vistas públicas** (`public_*`) para la web, sin costos ni stock exacto.
- Funciones SQL transaccionales para toda operación sensible (`save_product`, `register_stock_in`, `adjust_stock`, `count_stock`, `create_sale`, `void_sale`, caja…).

### 2. Panel de stock (`/admin`)
- Login con email y contraseña (Supabase Auth).
- Inventario con búsqueda, filtros (categoría, proveedor, stock bajo/agotado), resumen y paginación.
- Alta y edición de producto con variantes y fotos (se comprimen en el navegador).
- Ingreso de mercadería, ajuste manual y recuento de inventario.
- Historial de movimientos.
- Diseño tomado del panel de El Terruño (paleta como base provisoria, centralizada en `src/app/globals.css`).

### 3. Calidad
- 43 tests: base de datos real en memoria (PGlite) con admin/empleado/anónimo, más validaciones.
- Lint, typecheck y build de producción sin errores.

## Permisos

| | Admin | Empleado |
|---|---|---|
| Ver inventario, movimientos y ventas | ✅ | ✅ (sin costos) |
| Crear/editar productos, ingresos, ajustes | ✅ | — |
| Registrar ventas, abrir/cerrar caja | ✅ | ✅ |
| Anular ventas, ver costos y ganancias | ✅ | — |

## Estado actual

- Código commiteado en `master` (`2452a23`).
- **Pendiente en Supabase:** aplicar las 3 migraciones, crear el usuario admin y desactivar el registro público. Sin eso el login no funciona. Pasos en el [README principal](../README.md).
- La app **no se probó contra Supabase real** todavía (login, subida de fotos a Storage, consultas del panel).

## Próximos pasos

1. Conectar y verificar contra Supabase.
2. Interfaz de punto de venta, ventas y caja con ticket (el modelo ya existe).
3. Landing y catálogo público con pedido por WhatsApp.
4. Importar el Excel de productos del cliente.
5. Alta de empleados desde el panel.

## Comandos

```bash
npm run dev         # desarrollo (http://localhost:3000/admin)
npm test            # tests
npm run lint
npm run typecheck
npm run build
```
