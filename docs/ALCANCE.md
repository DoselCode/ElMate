# Alcance vs. presupuestos

Comparación de lo desarrollado con los dos presupuestos de DoselCode:
**Stock ElMate** (09/09/2026, 40 h) y **Landing El Mate** (21/09/2026, 28 h). Total: **68 h**.

## Entrega intermedia = 50 %

Las dos propuestas cobran el segundo 25 % contra un hito intermedio:

- **Stock:** "Semana 3: inventario y stock operativos".
- **Landing:** "Semana 2: diseño y catálogo publicados online".

Lo que está **visible** hoy suma unas **34 h de 68 (50 %)**. Ventas, caja, cierre e ingresos ya están
desarrollados, pero corresponden a la entrega final: quedan **ocultos** con un interruptor
(`src/shared/features.ts`). Para verlos en desarrollo, agregar `NEXT_PUBLIC_ELMATE_ETAPA2=1` en `.env.local`.

Referencias: ✅ hecho y visible · 🟡 parcial · 🔒 hecho pero oculto hasta la entrega final · ⏳ pendiente.

## Stock ElMate (40 h)

| Módulo | Horas | Estado | Detalle |
|---|---|---|---|
| 1. Control de inventario y stock | 6 | ✅ | Stock al día por variante, ingreso de mercadería, ajustes con motivo obligatorio, recuento, avisos de stock mínimo, historial de movimientos con usuario. |
| 2. Gestión de precios y productos | 9 | 🟡 | ✅ Catálogo con código, categoría, foto, marca, proveedor y unidad (unidad/kg); precio y costo con % de ganancia (como la lista del local); carga inicial desde Excel (494 productos). ⏳ Actualización masiva de precios por categoría/proveedor, historial de precios, importador de Excel en el panel. |
| 3. Gestión de caja y ventas | 10 | 🔒 | Pantalla de venta con búsqueda y lector de código de barras, ajuste automático por forma de pago, descuento sobre el total, ticket (no válido como factura), anulación con motivo y usuario. ⏳ Para cerrar el módulo: descuento por producto y en %, y **permitir vender sin stock con advertencia** (hoy la venta se bloquea). |
| 4. Dashboard administrativo | 6 | ⏳ | Indicadores del día, estado de caja, últimos movimientos, ranking de más vendidos y sin movimiento. (La pantalla "Ingresos" mensual ya existe, oculta.) |
| 5. Cierre de caja y arqueo | 5 | 🔒 | Apertura con efectivo inicial, retiros e ingresos de efectivo, cierre con sobrante/faltante, historial de cierres. |
| 6. Infraestructura, despliegue y backups | 2 | 🟡 | Base en Supabase lista. ⏳ Despliegue en Vercel. Backups diarios con 30 días: el plan gratis de Supabase no los incluye (requiere plan Pro). |
| 7. Puesta en marcha y capacitación | 2 | 🟡 | Catálogo inicial cargado (494 de hasta 500). ⏳ Stock inicial (el Excel no lo trae) y capacitación. |

## Landing El Mate (28 h)

| Módulo | Horas | Estado | Detalle |
|---|---|---|---|
| 1. Diseño y experiencia de usuario | 8 | ✅ | Diseño a medida (Figma "Diseño 2"), responsive, home con banner, destacados y categorías, animaciones. |
| 2. Catálogo de productos | 5 | 🟡 | ✅ Listado por categorías, buscador, orden por precio, solo ofertas, ficha con galería, indicador de stock. ⏳ Filtros por rango de precio y por disponibilidad. |
| 3. Panel de configuración propia | 4 | 🟡 | ✅ Alta/baja/edición de productos con fotos, activar/desactivar, datos de contacto, redes y horarios. ⏳ Editar banner principal y textos de la home desde el panel. |
| 4. Carrito y pedido por WhatsApp | 3 | 🟡 | ✅ Carrito y mensaje armado al WhatsApp del local; la ficha muestra el precio por forma de pago. ⏳ Elegir el método de pago en el carrito. |
| 5. Integración con MercadoLibre | 1 | ⏳ | Link al perfil y botón "Comprar en MercadoLibre" por producto. |
| 6. Roles, usuarios y auditoría | 5 | 🟡 | ✅ Roles admin/empleado con permisos en la base; cada movimiento de stock y venta guarda usuario y fecha. ⏳ Registro de auditoría general (cambios de productos, precios y configuración) y alta de usuarios desde el panel. |
| 7. Infraestructura, dominio y despliegue | 2 | ⏳ | Vercel, dominio y SSL. |

## Fuera de presupuesto

- **Historial de ingresos 2026** (totales mensuales importados del Excel): el presupuesto de Stock excluye la
  "migración de datos históricos". Está cargado en la base pero se ve solo en "Ingresos" (oculta). Si el
  cliente lo quiere, se cotiza aparte.
- **Precios mayoristas / empresariales y presupuestos** (hojas del Excel): no están en ninguno de los dos
  presupuestos.
