"use server";

import { revalidatePath } from "next/cache";
import { getAdminOrNull } from "@/lib/auth";
import { friendlyDbError } from "@/lib/db-errors";
import { fieldErrors, productSchema, toSavePayload } from "@/lib/schemas/product";
import { stockAdjustSchema, stockInSchema } from "@/lib/schemas/stock";
import { slugify, uniqueSlug } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

const NOT_ALLOWED = { ok: false, error: "Solo un administrador puede hacer esto." } as const;
const INVALID = { ok: false, error: "Revisá los datos ingresados." } as const;

function refreshStock() {
  revalidatePath("/admin/stock", "layout");
}

export async function saveProductAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await getAdminOrNull())) return NOT_ALLOWED;

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ...INVALID, fieldErrors: fieldErrors(parsed.error) };
  const product = parsed.data;

  const supabase = await createClient();

  // Al editar se conserva el slug (la URL pública no cambia si se renombra el producto)
  let slug: string;
  if (product.id) {
    const { data } = await supabase.from("products").select("slug").eq("id", product.id).maybeSingle();
    if (!data) return { ok: false, error: "El producto ya no existe." };
    slug = data.slug;
  } else {
    slug = await uniqueSlug(slugify(product.name), async (candidate) => {
      const { data } = await supabase.from("products").select("id").eq("slug", candidate).maybeSingle();
      return Boolean(data);
    });
  }

  const { data, error } = await supabase.rpc("save_product", { p: toSavePayload(product, slug) });
  if (error) return { ok: false, error: friendlyDbError(error) };

  refreshStock();
  return { ok: true, id: data as string };
}

export async function registerStockInAction(input: unknown): Promise<ActionResult> {
  if (!(await getAdminOrNull())) return NOT_ALLOWED;
  const parsed = stockInSchema.safeParse(input);
  if (!parsed.success) return { ...INVALID, fieldErrors: fieldErrors(parsed.error) };

  const { variantId, quantity, unitCost, reason } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_stock_in", {
    p_variant_id: variantId,
    p_quantity: quantity,
    p_unit_cost: unitCost,
    p_reason: reason || null,
  });
  if (error) return { ok: false, error: friendlyDbError(error) };

  refreshStock();
  return { ok: true };
}

export async function adjustStockAction(input: unknown): Promise<ActionResult<{ delta: number }>> {
  if (!(await getAdminOrNull())) return NOT_ALLOWED;
  const parsed = stockAdjustSchema.safeParse(input);
  if (!parsed.success) return { ...INVALID, fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const adjust = parsed.data;

  if (adjust.mode === "count") {
    const { data, error } = await supabase.rpc("count_stock", {
      p_variant_id: adjust.variantId,
      p_counted: adjust.counted,
      p_reason: adjust.reason || null,
    });
    if (error) return { ok: false, error: friendlyDbError(error) };
    refreshStock();
    return { ok: true, delta: Number(data) };
  }

  const { error } = await supabase.rpc("adjust_stock", {
    p_variant_id: adjust.variantId,
    p_delta: adjust.delta,
    p_reason: adjust.reason,
  });
  if (error) return { ok: false, error: friendlyDbError(error) };
  refreshStock();
  return { ok: true, delta: adjust.delta };
}

/** Archivar saca el producto del panel y de la web, pero conserva su historial de ventas y movimientos. */
export async function archiveProductAction(productId: string): Promise<ActionResult> {
  if (!(await getAdminOrNull())) return NOT_ALLOWED;
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return INVALID;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update({ archived_at: new Date().toISOString(), is_visible: false })
    .eq("id", productId)
    .select("id");
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!data?.length) return { ok: false, error: "El producto ya no existe." };

  refreshStock();
  return { ok: true };
}
