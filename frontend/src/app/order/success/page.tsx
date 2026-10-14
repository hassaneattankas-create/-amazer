"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { OrderConfirmation } from "@/components/order/OrderConfirmation";

// Variante ?id= pour l'application mobile (export statique sans route dynamique).
function OrderSuccessContent() {
  const searchParams = useSearchParams();
  return <OrderConfirmation orderId={searchParams.get("id") ?? ""} />;
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={null}>
      <OrderSuccessContent />
    </Suspense>
  );
}
