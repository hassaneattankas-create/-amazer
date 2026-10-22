"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { OrderPayFlow } from "@/components/order/OrderPayFlow";

/** Variante ?id= pour l'application mobile (export statique). */
function OrderPayPageContent() {
  const searchParams = useSearchParams();
  return <OrderPayFlow orderId={searchParams.get("id") ?? ""} />;
}

export default function OrderPayPage() {
  return (
    <Suspense fallback={<section className="mx-auto w-full max-w-3xl px-4 pb-14 sm:px-6" />}>
      <OrderPayPageContent />
    </Suspense>
  );
}
