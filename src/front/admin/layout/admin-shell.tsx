import type { ReactNode } from "react";
import type { Role } from "@/shared/types";
import { Sidebar } from "./sidebar";

/** Marco de todas las pantallas del panel: menú lateral + contenido. */
export function AdminShell({ userName, role, children }: { userName: string; role: Role; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col gap-4 p-3 lg:flex-row lg:gap-6 lg:p-6">
      <Sidebar userName={userName} role={role} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
