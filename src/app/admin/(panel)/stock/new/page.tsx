import type { Metadata } from "next";
import { requireAdmin } from "@/back/admin/auth/session";
import { getCatalogOptions } from "@/back/admin/stock/queries";
import { ProductForm } from "@/front/admin/stock/product-form";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function NewProductPage() {
  await requireAdmin();
  const { categories, suppliers } = await getCatalogOptions();
  return <ProductForm categories={categories} suppliers={suppliers} />;
}
