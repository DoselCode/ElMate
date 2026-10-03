import { Sidebar } from "@/components/admin/sidebar";
import { requireStaff } from "@/lib/auth";

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireStaff();

  return (
    <div className="flex min-h-screen flex-col gap-4 p-3 lg:flex-row lg:gap-6 lg:p-6">
      <Sidebar userName={user.fullName} role={user.role} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
