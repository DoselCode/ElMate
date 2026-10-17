import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductPage } from "@/back/landing/catalog";
import { ProductScreen } from "@/front/landing/product/product-screen";

export const revalidate = 60;

export async function generateMetadata({ params }: PageProps<"/producto/[slug]">): Promise<Metadata> {
  const data = await getProductPage((await params).slug);
  if (!data) return { title: "Producto no encontrado" };
  const { product } = data;
  return {
    title: product.name,
    description: product.description || `${product.name} en El Mate.`,
    openGraph: product.images[0] ? { images: [product.images[0]] } : undefined,
  };
}

export default async function ProductPage({ params }: PageProps<"/producto/[slug]">) {
  const data = await getProductPage((await params).slug);
  if (!data) notFound();
  return <ProductScreen data={data} />;
}
