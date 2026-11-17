# Casos de uso — QA ElMate

Entorno: `develop` en Coolify (`el-mate:develop`).
Actores: **Visitante** (web pública, sin login), **Empleado** y **Admin** (panel `/admin`).
Prioridad: **P1** crítico para vender · **P2** importante · **P3** secundario.
Los casos marcados con **[E2E]** están automatizados en `e2e/`.

## Web pública (Visitante)

| ID | Prioridad | Caso de uso | Pasos | Resultado esperado |
|---|---|---|---|---|
| CU-01 | P1 | Ver la home **[E2E]** | Abrir `/` | Carga banner, ofertas, categorías, destacados y footer sin errores de consola. |
| CU-02 | P1 | Navegar a la tienda **[E2E]** | Click en "Tienda" | `/tienda` lista productos con nombre, precio y botón "Agregar". |
| CU-03 | P1 | Filtrar por categoría **[E2E]** | En `/tienda`, click en "Yerbas" | URL `?categoria=yerbas`; todos los productos listados son de esa categoría. |
| CU-04 | P2 | Ordenar por precio **[E2E]** | Elegir "Menor precio" / "Mayor precio" | Los precios quedan ordenados ascendente / descendente. |
| CU-05 | P2 | Solo ofertas | Activar el filtro de ofertas | Solo se ven productos con precio "Antes / Ahora". |
| CU-06 | P1 | Buscar un producto **[E2E]** | Escribir "aguantadora" en el buscador | Aparecen solo productos que coinciden; sin resultados muestra un estado vacío claro. |
| CU-07 | P1 | Ver ficha de producto **[E2E]** | Click en un producto | Se ve nombre, categoría, precio, precios por forma de pago, stock y "Agregar al carrito". |
| CU-08 | P2 | Elegir variante | En un producto con variantes, cambiar la opción | Cambian precio y stock de la variante elegida. |
| CU-09 | P1 | Agregar al carrito con cantidad **[E2E]** | En la ficha, sumar a 2 y "Agregar al carrito" | El contador del carrito muestra 2; el carrito muestra el ítem y el total correcto. |
| CU-10 | P1 | Editar el carrito **[E2E]** | Sumar, restar y quitar ítems | Cantidades y total se recalculan; al vaciarlo se deshabilita el envío. |
| CU-11 | P1 | Enviar pedido por WhatsApp **[E2E]** | "Enviar pedido por WhatsApp" | Link `wa.me/<número del local>` con el detalle (cantidad × producto — subtotal) y el total. |
| CU-12 | P2 | Carrito persistente | Agregar, recargar la página | El carrito conserva los ítems. |
| CU-13 | P2 | Producto sin stock | Abrir un producto "Sin stock" | Se indica sin stock y no se puede agregar (o se advierte). |
| CU-14 | P2 | Producto inexistente **[E2E]** | Abrir `/producto/no-existe` | Página 404, no error 500. |
| CU-15 | P3 | Datos del local / contacto | Click en "Contacto" | Se ven WhatsApp, redes y horarios cargados en el panel. |
| CU-16 | P3 | Blog | Abrir un post desde la home | El post carga con título y contenido. |
| CU-17 | P2 | Responsive | Repetir CU-01, CU-02, CU-09 en 375 px | Sin scroll horizontal; menú y carrito usables. |

## Panel (Admin / Empleado)

| ID | Prioridad | Caso de uso | Actor | Resultado esperado |
|---|---|---|---|---|
| CU-20 | P1 | Login correcto **[E2E]** | Admin | Con usuario válido entra al panel. |
| CU-21 | P1 | Login inválido **[E2E]** | Cualquiera | Con clave incorrecta muestra error y no entra. |
| CU-22 | P1 | Ruta protegida **[E2E]** | Visitante | `/admin/*` sin sesión redirige a `/admin/login`. |
| CU-23 | P1 | Ver stock | Admin, Empleado | Lista de productos con variantes y stock; empleado no ve costos. |
| CU-24 | P1 | Crear producto | Admin | Producto con variante, precio y foto; aparece en stock y en la web si está activo. |
| CU-25 | P2 | Editar / desactivar producto | Admin | Los cambios se ven en la web; desactivado deja de aparecer. |
| CU-26 | P1 | Ingreso de mercadería | Admin | Sube el stock y queda un movimiento con usuario. |
| CU-27 | P1 | Ajuste de stock con motivo | Admin | Sin motivo no deja guardar; con motivo ajusta y registra el movimiento. |
| CU-28 | P2 | Historial de movimientos | Admin, Empleado | Lista movimientos con tipo, cantidad, saldo y usuario. |
| CU-29 | P1 | Abrir caja | Admin, Empleado | Con efectivo inicial; sin caja abierta no se puede vender. |
| CU-30 | P1 | Registrar venta (POS) | Admin, Empleado | Buscar producto, elegir forma de pago (aplica recargo/descuento), confirmar; descuenta stock y genera ticket. |
| CU-31 | P2 | Venta sin stock | Admin, Empleado | Hoy se bloquea (comportamiento documentado). |
| CU-32 | P1 | Anular venta con motivo | Admin | Devuelve el stock y registra motivo y usuario; empleado no puede anular. |
| CU-33 | P1 | Cerrar caja (arqueo) | Admin, Empleado | Calcula esperado vs. contado y muestra sobrante/faltante. |
| CU-34 | P2 | Crear / editar promoción | Admin | La promo se ve en la home y en los precios de la web. |
| CU-35 | P2 | Datos del local | Admin | WhatsApp, contacto, redes y horarios se reflejan en la web y el carrito. |
| CU-36 | P3 | Ingresos mensuales | Admin | Se ven los totales por mes. |
