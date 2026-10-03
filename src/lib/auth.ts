import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "empleado";

export type CurrentUser = {
  id: string;
  email: string | null;
  fullName: string;
  role: Role;
};

/**
 * Usuario logueado y activo, o null. El JWT se verifica con getClaims(); el rol se lee de la base
 * (no del token) para que un cambio de rol o una baja tengan efecto inmediato.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, active")
    .eq("id", claims.sub)
    .maybeSingle();
  if (!profile?.active) return null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    fullName: profile.full_name || (typeof claims.email === "string" ? claims.email : "Usuario"),
    role: profile.role as Role,
  };
});

/** Para páginas y acciones del panel: cualquier personal activo. */
export async function requireStaff(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login?error=sin-acceso");
  return user;
}

/** Para páginas del panel que solo ve el admin. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireStaff();
  if (user.role !== "admin") redirect("/admin/stock");
  return user;
}

/** Para Server Actions: no redirige, devuelve null si no corresponde para poder responder con un error. */
export async function getAdminOrNull(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}
