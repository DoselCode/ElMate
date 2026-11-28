import { requireStaff } from "@/back/admin/auth/session";
import { getStoreInfo } from "@/back/landing/catalog";
import { AdminShell } from "@/front/admin/layout/admin-shell";

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  // El logo cargado en "Datos del local" también va en el menú del panel
  const [user, store] = await Promise.all([requireStaff(), getStoreInfo()]);
  return (
    <AdminShell userName={user.fullName} role={user.role} logo={store.logo}>
      {children}
    </AdminShell>
  );
}
