import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

/**
 * Cliente anónimo para la web pública: no lee cookies ni sesión, así las páginas de la tienda
 * se pueden cachear (ISR). Solo ve lo que la base expone a `anon`: las vistas public_*.
 */
export function createPublicClient() {
  const { url, key } = supabaseEnv();
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
