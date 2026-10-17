"use server";

import { revalidatePath } from "next/cache";
import { getAdminOrNull } from "@/back/admin/auth/session";
import { friendlyDbError } from "@/back/shared/db-errors";
import { createClient } from "@/back/shared/supabase/server";
import { fieldErrors } from "@/shared/schemas/product";
import { paymentMethodsSchema } from "@/shared/schemas/payment-methods";
import { storeSettingsSchema } from "@/shared/schemas/settings";
import type { ActionResult } from "@/shared/types";

/** Guarda "Datos del local" y refresca la web pública (footer, WhatsApp del carrito). */
export async function saveStoreSettingsAction(input: unknown): Promise<ActionResult> {
  if (!(await getAdminOrNull())) return { ok: false, error: "Solo un administrador puede hacer esto." };

  const parsed = storeSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá los datos ingresados.", fieldErrors: fieldErrors(parsed.error) };
  const s = parsed.data;
  const orNull = (v: string) => v || null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_settings")
    .update({
      name: s.name,
      tagline: orNull(s.tagline),
      whatsapp_number: orNull(s.whatsappNumber),
      phone: orNull(s.phone),
      email: orNull(s.email),
      address: orNull(s.address),
      instagram_url: orNull(s.instagramUrl),
      facebook_url: orNull(s.facebookUrl),
      hours_weekdays: orNull(s.hoursWeekdays),
      hours_saturday: orNull(s.hoursSaturday),
      hours_sunday: orNull(s.hoursSunday),
    })
    .eq("id", 1)
    .select("id");
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!data?.length) return { ok: false, error: "No se pudo guardar: falta la fila de configuración en la base." };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Guarda la lista completa de formas de pago (orden incluido). No se borran: las que ya se usaron
 * en ventas quedan en el historial; para dejar de usarlas se desactivan.
 */
export async function savePaymentMethodsAction(input: unknown): Promise<ActionResult> {
  if (!(await getAdminOrNull())) return { ok: false, error: "Solo un administrador puede hacer esto." };

  const parsed = paymentMethodsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá las formas de pago.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  for (const [i, m] of parsed.data.entries()) {
    const row = { name: m.name, adjustment_pct: m.adjustmentPct, is_cash: m.isCash, active: m.active, sort_order: i + 1 };
    const { error } = m.id
      ? await supabase.from("payment_methods").update(row).eq("id", m.id)
      : await supabase.from("payment_methods").insert(row);
    if (error) return { ok: false, error: friendlyDbError(error) };
  }

  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
  return { ok: true };
}
