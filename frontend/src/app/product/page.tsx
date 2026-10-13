"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { ProductDetailView } from "@/components/product/ProductDetailView";

/** Variante a parametre `?id=` utilisee par l'export statique de l'application mobile. */
function ProductDetailPageContent() {
  const searchParams = useSearchParams();
  return <ProductDetailView productId={searchParams.get("id") ?? ""} />;
}

export default function ProductDetailPage() {
  return (
    <Suspense fallback={<section className="mx-auto w-full max-w-7xl px-gutter py-6" aria-busy="true" />}>
      <ProductDetailPageContent />
    </Suspense>
  );
}
