import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Option } from "@/lib/types";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function NewProductPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [categories, suppliers] = await Promise.all([
    supabase.from("categories").select("id, name").order("sort_order").order("name"),
    supabase.from("suppliers").select("id, name").eq("active", true).order("name"),
  ]);

  return <ProductForm categories={(categories.data ?? []) as Option[]} suppliers={(suppliers.data ?? []) as Option[]} />;
}
