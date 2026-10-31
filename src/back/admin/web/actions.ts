"use server";

import { revalidatePath } from "next/cache";
import { getAdminOrNull } from "@/back/admin/auth/session";
import { friendlyDbError } from "@/back/shared/db-errors";
import { createClient } from "@/back/shared/supabase/server";
import { cleanHomeTexts, HOME_FIELDS } from "@/shared/home-content";
import type { ActionResult } from "@/shared/types";

/**
 * Guarda los textos de la home. Solo se guardan los que difieren del texto por defecto: un campo
 * vacío o igual al original vuelve al default. Refresca la web pública.
 */
export async function saveHomeTextsAction(input: unknown): Promise<ActionResult> {
  if (!(await getAdminOrNull())) return { ok: false, error: "Solo un administrador puede hacer esto." };
  if (!input || typeof input !== "object") return { ok: false, error: "Revisá los datos ingresados." };

  // Un texto más largo que el máximo del campo se rechaza (no se recorta en silencio)
  const fieldErrors: Record<string, string> = {};
  for (const f of HOME_FIELDS) {
    const v = (input as Record<string, unknown>)[f.key];
    if (typeof v === "string" && v.trim().length > f.max) fieldErrors[f.key] = `Máximo ${f.max} caracteres`;
  }
  if (Object.keys(fieldErrors).length > 0) return { ok: false, error: "Revisá los campos marcados en rojo.", fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("home_content")
    .update({ texts: cleanHomeTexts(input) })
    .eq("id", 1)
    .select("id");
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!data?.length) return { ok: false, error: "No se pudo guardar: falta la fila de configuración en la base." };

  revalidatePath("/", "layout");
  return { ok: true };
}
