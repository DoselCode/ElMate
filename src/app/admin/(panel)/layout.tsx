import { requireStaff } from "@/back/admin/auth/session";
import { AdminShell } from "@/front/admin/layout/admin-shell";

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireStaff();
  return (
    <AdminShell userName={user.fullName} role={user.role}>
      {children}
    </AdminShell>
  );
}
