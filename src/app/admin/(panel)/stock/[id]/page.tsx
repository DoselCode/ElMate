import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Option } from "@/lib/types";
import { ProductForm, type ProductInitial } from "../product-form";

export const metadata: Metadata = { title: "Editar producto" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditProductPage({ params }: PageProps<"/admin/stock/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const [productRes, variantsRes, categories, suppliers] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, description, category_id, supplier_id, option_names, images, is_visible, badge")
      .eq("id", id)
      .is("archived_at", null)
      .maybeSingle(),
    supabase
      .from("product_variants")
      .select("id, sku, barcode, attributes, price, min_stock, stock, active")
      .eq("product_id", id)
      .order("created_at"),
    supabase.from("categories").select("id, name").order("sort_order").order("name"),
    supabase.from("suppliers").select("id, name").eq("active", true).order("name"),
  ]);

  const product = productRes.data;
  if (!product) notFound();

  const variants = variantsRes.data ?? [];
  const { data: costRows } = await supabase
    .from("variant_costs")
    .select("variant_id, cost")
    .in("variant_id", variants.map((v) => v.id));
  const costs = new Map((costRows ?? []).map((c) => [c.variant_id, Number(c.cost)]));

  const initial: ProductInitial = {
    id: product.id,
    name: product.name,
    description: product.description,
    categoryId: product.category_id,
    supplierId: product.supplier_id,
    optionNames: product.option_names,
    images: product.images,
    isVisible: product.is_visible,
    badge: product.badge,
    variants: variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      barcode: v.barcode,
      attributes: (v.attributes ?? {}) as Record<string, string>,
      price: Number(v.price),
      cost: costs.get(v.id) ?? 0,
      minStock: v.min_stock,
      stock: v.stock,
      active: v.active,
    })),
  };

  return (
    <ProductForm
      key={product.id}
      initial={initial}
      categories={(categories.data ?? []) as Option[]}
      suppliers={(suppliers.data ?? []) as Option[]}
    />
  );
}
