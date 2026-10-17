import type { Metadata } from "next";
import { requireAdmin } from "@/back/admin/auth/session";
import { getCatalogOptions } from "@/back/admin/stock/queries";
import { ProductForm } from "@/front/admin/stock/product-form";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function NewProductPage() {
  const [, { categories, suppliers }] = await Promise.all([requireAdmin(), getCatalogOptions()]);
  return <ProductForm categories={categories} suppliers={suppliers} />;
}
