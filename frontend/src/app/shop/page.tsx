"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ShopView } from "@/components/storefront/ShopView";

// Variante ?vendorId= pour l'application mobile (export statique sans route dynamique).
function ShopContent() {
  const searchParams = useSearchParams();
  return <ShopView vendorId={searchParams.get("vendorId") ?? ""} />;
}

export default function VendorShopPage() {
  return (
    <Suspense fallback={null}>
      <ShopContent />
    </Suspense>
  );
}
