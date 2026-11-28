import type { Role } from "./types";

/**
 * Pantalla de inicio de cada rol. El admin arranca en el inventario; el empleado solo usa Nueva venta
 * y Caja, así que arranca en Nueva venta.
 */
export function homeFor(role: Role): string {
  return role === "admin" ? "/admin/stock" : "/admin/ventas/nueva";
}
