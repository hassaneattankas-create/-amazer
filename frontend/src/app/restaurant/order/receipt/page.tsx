"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { ReceiptView } from "@/components/order/ReceiptView";
import { getRestaurantSecureReceipt } from "@/services/restaurant-service";

function RestaurantOrderReceiptPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? undefined;
  const orderId = searchParams.get("id") ?? "";

  const { data, isPending, isError } = useQuery({
    queryKey: ["restaurant-secure-receipt", orderId, token],
    queryFn: () => getRestaurantSecureReceipt(orderId, token),
    enabled: Boolean(orderId),
  });

  return <ReceiptView receipt={data} isPending={isPending} isError={isError} backHref="/restaurant" />;
}

export default function RestaurantOrderReceiptPage() {
  return (
    <Suspense fallback={<section className="mx-auto w-full max-w-3xl px-4 pb-14 sm:px-6" />}>
      <RestaurantOrderReceiptPageContent />
    </Suspense>
  );
}
