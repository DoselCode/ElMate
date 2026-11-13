"use server";

import { revalidatePath } from "next/cache";
import { getAdminOrNull } from "@/back/admin/auth/session";
import { friendlyDbError } from "@/back/shared/db-errors";
import { createClient } from "@/back/shared/supabase/server";
import { fieldErrors } from "@/shared/schemas/product";
import { promotionSchema, toPromotionPayload } from "@/shared/schemas/promotion";
import { slugify, uniqueSlug } from "@/shared/slug";
import type { ActionResult, PromotionVariantHit } from "@/shared/types";

const NOT_ALLOWED = { ok: false, error: "Solo un administrador puede hacer esto." } as const;

/** Las promos cambian precios, cards y filtros de la web pública. */
function refresh() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/promociones");
}

export async function savePromotionAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await getAdminOrNull())) return NOT_ALLOWED;

  const parsed = promotionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá los datos ingresados.", fieldErrors: fieldErrors(parsed.error) };
  const promo = parsed.data;

  const supabase = await createClient();

  // La promo tiene que ser más barata que el precio de lista: si no, la web la ignoraría sin avisar
  if (promo.items.length > 0) {
    const { data } = await supabase
      .from("stock_overview")
      .select("variant_id, product_name, price")
      .in("variant_id", promo.items.map((i) => i.variantId));
    const list = new Map((data ?? []).map((r) => [r.variant_id as string, r]));
    for (const [i, item] of promo.items.entries()) {
      const row = list.get(item.variantId);
      if (!row) return { ok: false, error: "Un producto de la promo ya no existe. Quitalo y volvé a guardar." };
      if (item.promoPrice >= Number(row.price)) {
        return {
          ok: false,
          error: `El precio de “${row.product_name}” tiene que ser menor al de lista.`,
          fieldErrors: { [`items.${i}.promoPrice`]: "Menor al precio de lista" },
        };
      }
    }
  }

  // Al editar se conserva el slug (los links ?promo=... no cambian si se renombra)
  let slug: string;
  if (promo.id) {
    const { data } = await supabase.from("promotions").select("slug").eq("id", promo.id).maybeSingle();
    if (!data) return { ok: false, error: "La promoción ya no existe." };
    slug = data.slug;
  } else {
    slug = await uniqueSlug(slugify(promo.name) || "promo", async (candidate) => {
      const { data } = await supabase.from("promotions").select("id").eq("slug", candidate).maybeSingle();
      return Boolean(data);
    });
  }

  const { data, error } = await supabase.rpc("save_promotion", { p: toPromotionPayload(promo, slug) });
  if (error) return { ok: false, error: friendlyDbError(error) };

  refresh();
  return { ok: true, id: data as string };
}

export async function deletePromotionAction(id: string): Promise<ActionResult> {
  if (!(await getAdminOrNull())) return NOT_ALLOWED;
  const supabase = await createClient();
  const { error } = await supabase.from("promotions").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyDbError(error) };
  refresh();
  return { ok: true };
}

/** Busca variantes activas por nombre o código para sumarlas a una promoción (máx. 12). */
export async function searchPromotionVariantsAction(text: string): Promise<PromotionVariantHit[]> {
  if (!(await getAdminOrNull())) return [];
  const words = text.replace(/[,()"\\*%_]/g, " ").split(/\s+/).filter(Boolean).slice(0, 5);
  if (words.length === 0) return [];

  const supabase = await createClient();
  let query = supabase
    .from("stock_overview")
    .select("variant_id, product_name, variant_label, sku, price, image")
    .eq("active", true)
    .gt("price", 0);
  for (const w of words) query = query.or(`product_name.ilike.%${w}%,sku.ilike.%${w}%,variant_label.ilike.%${w}%`);
  const { data } = await query.order("product_name").limit(12);
  return (data ?? []).map((r) => ({
    variantId: r.variant_id as string,
    productName: r.product_name as string,
    variantLabel: (r.variant_label as string) ?? "",
    sku: r.sku as string,
    price: Number(r.price),
    image: (r.image as string | null) ?? null,
  }));
}
