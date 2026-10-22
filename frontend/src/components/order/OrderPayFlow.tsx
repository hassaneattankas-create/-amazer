"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";

import { ManualPaymentCard } from "@/components/order/ManualPaymentCard";
import { getApiErrorMessage } from "@/lib/api-error";
import { getOrderSuccessRoute } from "@/lib/mobile-routes";
import { confirmPayment, getPaymentIntent, startAmanaPayment } from "@/services/order-service";

/** Paiement d'une commande (partagé par /order/pay/[id] et /order/pay?id= de l'application). */
export function OrderPayFlow({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { data, isPending, isError } = useQuery({
    queryKey: ["payment-intent", orderId],
    queryFn: () => getPaymentIntent(orderId),
    enabled: Boolean(orderId),
  });

  const mutation = useMutation({
    mutationFn: (providerReference: string) => confirmPayment(orderId, { provider_reference: providerReference || undefined }),
    onSuccess: (result) => {
      // Hors Amana, le serveur laisse le paiement en attente de vérification par AMAZER.
      if (result.payment_status === "paid") {
        window.setTimeout(() => router.push(getOrderSuccessRoute(orderId)), 600);
      }
    },
  });
  const startMutation = useMutation({ mutationFn: () => startAmanaPayment(orderId) });

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
