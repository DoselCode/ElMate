import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCashAdjustmentPct } from "@/back/admin/settings/queries";
import { getCatalogOptions, getProductForEdit } from "@/back/admin/stock/queries";
import { ProductForm } from "@/front/admin/stock/product-form";

export const metadata: Metadata = { title: "Editar producto" };

export default async function EditProductPage({ params }: PageProps<"/admin/stock/[id]">) {
  const { id } = await params;
  const [product, { categories, suppliers }, cashAdjustmentPct] = await Promise.all([
    getProductForEdit(id),
    getCatalogOptions(),
    getCashAdjustmentPct(),
  ]);
  if (!product) notFound();

  return (
    <ProductForm
      key={product.id}
      initial={product}
      categories={categories}
      suppliers={suppliers}
      cashAdjustmentPct={cashAdjustmentPct}
    />
  );
}
