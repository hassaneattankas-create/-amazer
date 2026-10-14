"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ResellerShopView } from "@/components/reseller/ResellerShopView";

// Variante ?u= pour l'application mobile (export statique).
function ResellerShopContent() {
  const searchParams = useSearchParams();
  return <ResellerShopView resellerId={searchParams.get("u") ?? ""} />;
}

export default function ResellerShopPage() {
  return (
    <Suspense fallback={null}>
      <ResellerShopContent />
    </Suspense>
  );
}
