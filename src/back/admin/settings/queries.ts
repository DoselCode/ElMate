import "server-only";
import { requireAdmin, requireStaff } from "@/back/admin/auth/session";
import { createClient } from "@/back/shared/supabase/server";
import type { StoreSettingsInput } from "@/shared/schemas/settings";
import type { PaymentMethod } from "@/shared/types";

const toMethod = (m: PaymentMethod): PaymentMethod => ({ ...m, adjustment_pct: Number(m.adjustment_pct) });

/** Formas de pago en el orden del local. `includeInactive` es para la pantalla de configuración. */
export async function getPaymentMethods(includeInactive = false): Promise<PaymentMethod[]> {
  const supabase = await createClient();
  let query = supabase.from("payment_methods").select("id, name, adjustment_pct, is_cash, sort_order, active");
  if (!includeInactive) query = query.eq("active", true);
  const [, { data }] = await Promise.all([requireStaff(), query.order("sort_order").order("name")]);
  return ((data ?? []) as PaymentMethod[]).map(toMethod);
}

/** Ajuste del efectivo (ej: −20): la ganancia de la lista se calcula sobre ese precio. */
export async function getCashAdjustmentPct(): Promise<number> {
  const methods = await getPaymentMethods();
  return methods.find((m) => m.is_cash)?.adjustment_pct ?? 0;
}

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
