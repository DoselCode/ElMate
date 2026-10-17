import "server-only";
import { requireAdmin } from "@/back/admin/auth/session";
import { createClient } from "@/back/shared/supabase/server";
import type { StoreSettingsInput } from "@/shared/schemas/settings";

/** Datos del local para el formulario de "Datos del local". Solo admin. */
export async function getStoreSettings(): Promise<StoreSettingsInput> {
  const supabase = await createClient();
  // La lectura va en paralelo con el chequeo de admin (RLS igual protege la tabla): un viaje menos
  const [, { data }] = await Promise.all([
    requireAdmin(),
    supabase.from("store_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  const s = data ?? {};
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    name: text(s.name) || "El Mate",
    tagline: text(s.tagline),
    whatsappNumber: text(s.whatsapp_number),
    phone: text(s.phone),
    email: text(s.email),
    address: text(s.address),
    instagramUrl: text(s.instagram_url),
    facebookUrl: text(s.facebook_url),
    hoursWeekdays: text(s.hours_weekdays),
    hoursSaturday: text(s.hours_saturday),
    hoursSunday: text(s.hours_sunday),
  };
}
