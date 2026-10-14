"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { CategoryView } from "@/components/catalog/CategoryView";

// Variante ?slug= pour l'application mobile (export statique).
function CategoryContent() {
  const searchParams = useSearchParams();
  return <CategoryView slug={searchParams.get("slug") ?? ""} />;
}

export default function CategoryPage() {
  return (
    <Suspense fallback={null}>
      <CategoryContent />
    </Suspense>
  );
}
