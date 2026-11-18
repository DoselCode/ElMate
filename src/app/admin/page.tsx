import { redirect } from "next/navigation";
import { requireStaff } from "@/back/admin/auth/session";
import { homeFor } from "@/shared/roles";

/** Entrada del panel: cada rol arranca en su pantalla (admin: inventario; empleado: nueva venta). */
export default async function AdminIndex() {
  const user = await requireStaff();
  redirect(homeFor(user.role));
}
