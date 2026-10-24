import { notFound } from "next/navigation";
import { getProduct } from "@/services/products/catalog";
import { ProductDetailContent } from "@/components/product/product-detail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);
  return {
    title: product
      ? `${product.canonical_name}${product.strength ? ` ${product.strength}` : ""}`
      : "Product",
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  return <ProductDetailContent product={product} />;
}
