"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import * as z from "zod";
import { createClient } from "@/back/shared/supabase/server";
import { ipFrom, rateLimit } from "@/shared/rate-limit";

/** Login y logout del panel (Server Actions). */

const credentials = z.object({
  email: z.email({ error: "Ingresá un email válido" }).trim(),
  password: z.string().min(1, { error: "Ingresá tu contraseña" }),
});

const LOGIN_WINDOW_MS = 15 * 60_000;

export type LoginState = { error?: string; email?: string } | undefined;

export async function signInAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const parsed = credentials.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  // Frena la fuerza bruta: por cuenta (contra quien prueba claves en un usuario) y por IP (contra quien prueba muchos)
  const ip = ipFrom(await headers());
  const byEmail = rateLimit(`login:email:${parsed.data.email.toLowerCase()}`, 8, LOGIN_WINDOW_MS);
  const byIp = rateLimit(`login:ip:${ip}`, 30, LOGIN_WINDOW_MS);
  if (!byEmail.ok || !byIp.ok) {
    return { error: "Demasiados intentos. Esperá unos minutos y probá de nuevo.", email };
  }

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
