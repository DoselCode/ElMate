import type { Metadata } from "next";
import { requireAdmin } from "@/back/admin/auth/session";
import { getCashAdjustmentPct } from "@/back/admin/settings/queries";
import { getCatalogOptions } from "@/back/admin/stock/queries";
import { ProductForm } from "@/front/admin/stock/product-form";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function NewProductPage() {
  const [, { categories, suppliers }, cashAdjustmentPct] = await Promise.all([
    requireAdmin(),
    getCatalogOptions(),
    getCashAdjustmentPct(),
  ]);
  return <ProductForm categories={categories} suppliers={suppliers} cashAdjustmentPct={cashAdjustmentPct} />;
}
