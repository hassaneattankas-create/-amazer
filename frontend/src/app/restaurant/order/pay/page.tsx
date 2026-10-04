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
  startRestaurantAmanaPayment,
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
  const startMutation = useMutation({ mutationFn: () => startRestaurantAmanaPayment(orderId) });

  return (
    <ManualPaymentCard
      orderId={orderId}
      data={data}
      isPending={isPending}
      isError={isError}
      isConfirming={mutation.isPending}
      isStarting={startMutation.isPending}
      status={
        startMutation.isSuccess
          ? "Paiement initialise. Validez dans AmanaTa, puis cliquez sur Verifier le paiement."
          : mutation.isSuccess
          ? "Paiement confirme. Redirection..."
          : mutation.isError
            ? "Confirmation impossible. Reessayez."
            : ""
      }
      onConfirm={(providerReference) => mutation.mutate(providerReference)}
      onStart={() => startMutation.mutate()}
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
