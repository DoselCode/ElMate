import "server-only";
import { requireAdmin } from "@/back/admin/auth/session";
import { createClient } from "@/back/shared/supabase/server";
import { cleanHomeTexts, type HomeTexts } from "@/shared/home-content";

/** Textos de la home que el usuario cambió (el resto usa los de por defecto). Solo admin. */
export async function getHomeTexts(): Promise<HomeTexts> {
  const supabase = await createClient();
  // La lectura va en paralelo con el chequeo de admin (RLS igual protege la tabla): un viaje menos
  const [, { data }] = await Promise.all([requireAdmin(), supabase.from("home_content").select("texts").eq("id", 1).maybeSingle()]);
  return cleanHomeTexts(data?.texts);
}
