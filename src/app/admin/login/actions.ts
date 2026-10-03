"use server";

import { redirect } from "next/navigation";
import * as z from "zod";
import { createClient } from "@/lib/supabase/server";

const credentials = z.object({
  email: z.email({ error: "Ingresá un email válido" }).trim(),
  password: z.string().min(1, { error: "Ingresá tu contraseña" }),
});

export type LoginState = { error?: string; email?: string } | undefined;

export async function signInAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const parsed = credentials.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // Mensaje único: no revela si el email existe
  if (error) return { error: "Email o contraseña incorrectos", email };

  redirect("/admin/stock");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
