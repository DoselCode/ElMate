import "server-only";
import { requireAdmin } from "@/back/admin/auth/session";
import { guarded } from "@/back/admin/auth/guarded";
import type { PromotionForEdit, PromotionRow, PromotionStatus } from "@/shared/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function promotionStatus(p: { active: boolean; starts_at: string; ends_at: string | null }, now = Date.now()): PromotionStatus {
  if (!p.active) return "pausada";
  if (new Date(p.starts_at).getTime() > now) return "programada";
  if (p.ends_at && new Date(p.ends_at).getTime() <= now) return "terminada";
  return "vigente";
}

/** Todas las promociones, las más nuevas primero. Solo admin. */
export async function listPromotions(): Promise<PromotionRow[]> {
  const res = await guarded(requireAdmin, (supabase) =>
    supabase
      .from("promotions")
      .select("id, name, slug, active, starts_at, ends_at, show_card, promotion_items(count)")
      .order("starts_at", { ascending: false }),
  );
  if (res.error) throw new Error("No se pudieron leer las promociones");
  return (res.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    active: p.active,
    starts_at: p.starts_at,
    ends_at: p.ends_at,
    show_card: p.show_card,
    item_count: Number((p.promotion_items as { count: number }[] | null)?.[0]?.count ?? 0),
    status: promotionStatus(p),
  }));
}

/** Una promoción con sus productos (nombre, variante y precio de lista actual), o null si no existe. Solo admin. */
export async function getPromotionForEdit(id: string): Promise<PromotionForEdit | null> {
  if (!UUID.test(id)) {
    await requireAdmin();
    return null;
  }
  const [promoRes, itemsRes] = await guarded(requireAdmin, (supabase) =>
    Promise.all([
      supabase
        .from("promotions")
        .select("id, name, description, active, starts_at, ends_at, show_card, card_title, card_text, card_cta")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("promotion_items").select("variant_id, promo_price").eq("promotion_id", id),
    ]),
  );
  const promo = promoRes.data;
  if (!promo) return null;
  if (itemsRes.error) throw new Error("No se pudieron leer los productos de la promoción");

  const items = itemsRes.data ?? [];
  const variantIds = items.map((i) => i.variant_id);
  const details = variantIds.length
    ? await guarded(requireAdmin, (supabase) =>
        supabase
          .from("stock_overview")
          .select("variant_id, product_name, variant_label, sku, price, image")
          .in("variant_id", variantIds),
      )
    : { data: [] };
  const byId = new Map((details.data ?? []).map((d) => [d.variant_id as string, d]));

  return {
    id: promo.id,
    name: promo.name,
    description: promo.description,
    active: promo.active,
    startsAt: promo.starts_at,
    endsAt: promo.ends_at,
    showCard: promo.show_card,
    cardTitle: promo.card_title,
    cardText: promo.card_text,
    cardCta: promo.card_cta,
    items: items
      .map((i) => {
        const d = byId.get(i.variant_id);
        return {
          variantId: i.variant_id as string,
          productName: (d?.product_name as string | undefined) ?? "Producto eliminado",
          variantLabel: (d?.variant_label as string | undefined) ?? "",
          sku: (d?.sku as string | undefined) ?? "",
          price: Number(d?.price ?? 0),
          image: (d?.image as string | null | undefined) ?? null,
          promoPrice: Number(i.promo_price),
        };
      })
      .sort((a, b) => a.productName.localeCompare(b.productName, "es")),
  };
}
