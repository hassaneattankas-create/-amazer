"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";

import { ManualPaymentCard } from "@/components/order/ManualPaymentCard";
import { getRestaurantOrderReceiptRoute } from "@/lib/mobile-routes";
import {
  confirmRestaurantPayment,
  getRestaurantPaymentIntent,
  getRestaurantReceiptLink,
} from "@/services/restaurant-service";

function RestaurantOrderPayPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("id") ?? "";

  const { data, isPending, isError } = useQuery({
    queryKey: ["restaurant-payment-intent", orderId],
    queryFn: () => getRestaurantPaymentIntent(orderId),
    enabled: Boolean(orderId),
  });

  const mutation = useMutation({
    mutationFn: (providerReference: string) =>
      confirmRestaurantPayment(orderId, {
        provider_reference: providerReference || undefined,
      }),
    onSuccess: async () => {
      const receipt = await getRestaurantReceiptLink(orderId);
      window.setTimeout(
        () => router.push(getRestaurantOrderReceiptRoute(orderId, receipt.token)),
        600
      );
    },
  });

  return (
    <ManualPaymentCard
      orderId={orderId}
      data={data}
      isPending={isPending}
      isError={isError}
      isConfirming={mutation.isPending}
      status={
        mutation.isSuccess
          ? "Paiement confirme. Redirection..."
          : mutation.isError
            ? "Confirmation impossible. Reessayez."
            : ""
      }
      onConfirm={(providerReference) => mutation.mutate(providerReference)}
    />
  );
}

export default function RestaurantOrderPayPage() {
  return (
    <Suspense fallback={<section className="mx-auto w-full max-w-3xl px-4 pb-14 sm:px-6" />}>
      <RestaurantOrderPayPageContent />
    </Suspense>
  );
}
