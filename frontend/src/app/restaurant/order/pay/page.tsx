"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { RestaurantPayFlow } from "@/components/order/RestaurantPayFlow";

/** Variante ?id= pour l'application mobile (export statique). */
function RestaurantOrderPayPageContent() {
  const searchParams = useSearchParams();
  return <RestaurantPayFlow orderId={searchParams.get("id") ?? ""} />;
}

export default function RestaurantOrderPayPage() {
  return (
    <Suspense fallback={<section className="mx-auto w-full max-w-3xl px-4 pb-14 sm:px-6" />}>
      <RestaurantOrderPayPageContent />
    </Suspense>
  );
}
