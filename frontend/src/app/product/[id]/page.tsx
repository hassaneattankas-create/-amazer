"use client";

import { useParams } from "next/navigation";

import { ProductDetailView } from "@/components/product/ProductDetailView";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  return <ProductDetailView productId={params.id} />;
}
