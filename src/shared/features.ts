/**
 * Etapas del proyecto según los presupuestos (Stock ElMate + Landing El Mate).
 *
 * La entrega intermedia (50 %) incluía inventario, productos y precios, y la web con catálogo y
 * carrito. Ventas, caja, cierre de caja e ingresos son de la entrega final: ya están desarrollados y
 * ahora se muestran. Para volver a ocultarlos (por ejemplo en una demo de la etapa 1) poner
 * NEXT_PUBLIC_ELMATE_ETAPA2=0.
 */
export const STAGE_2 = process.env.NEXT_PUBLIC_ELMATE_ETAPA2 !== "0";
