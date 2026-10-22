"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";

import { ManualPaymentCard } from "@/components/order/ManualPaymentCard";
import { getApiErrorMessage } from "@/lib/api-error";
import { getRestaurantOrderReceiptRoute } from "@/lib/mobile-routes";
import {
  confirmRestaurantPayment,
  getRestaurantPaymentIntent,
  getRestaurantReceiptLink,
  startRestaurantAmanaPayment,
} from "@/services/restaurant-service";

/** Paiement d'une commande restaurant (partagé par /restaurant/order/pay/[id] et ?id= de l'application). */
export function RestaurantPayFlow({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { data, isPending, isError } = useQuery({
    queryKey: ["restaurant-payment-intent", orderId],
    queryFn: () => getRestaurantPaymentIntent(orderId),
    enabled: Boolean(orderId),
  });

  const mutation = useMutation({
    mutationFn: (providerReference: string) =>
      confirmRestaurantPayment(orderId, { provider_reference: providerReference || undefined }),
    onSuccess: async (result) => {
      // Hors Amana, le serveur laisse le paiement en attente de vérification par AMAZER.
      if (result.payment_status !== "paid") return;
      const receipt = await getRestaurantReceiptLink(orderId);
      window.setTimeout(() => router.push(getRestaurantOrderReceiptRoute(orderId, receipt.token)), 600);
    },
  });
  const startMutation = useMutation({ mutationFn: () => startRestaurantAmanaPayment(orderId) });

  const status = mutation.isSuccess
    ? mutation.data.payment_status === "paid"
      ? "Paiement confirmé. Redirection…"
      : mutation.data.message
    : mutation.isError
      ? getApiErrorMessage(mutation.error, "Confirmation impossible. Réessayez.")
      : startMutation.isSuccess
        ? "Paiement lancé. Validez-le dans AmanaTa, puis appuyez sur « Vérifier le paiement »."
        : startMutation.isError
          ? getApiErrorMessage(startMutation.error, "Le paiement Amana n'a pas pu être lancé. Réessayez.")
          : "";

  return (
    <ManualPaymentCard
      orderId={orderId}
      data={data}
      isPending={isPending}
      isError={isError}
      isConfirming={mutation.isPending}
      isStarting={startMutation.isPending}
      awaitingReview={mutation.isSuccess && mutation.data.payment_status !== "paid"}
      status={status}
      onConfirm={(providerReference) => mutation.mutate(providerReference)}
      onStart={() => startMutation.mutate()}
    />
  );
}
