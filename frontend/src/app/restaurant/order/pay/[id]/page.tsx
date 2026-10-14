"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";

import { ManualPaymentCard } from "@/components/order/ManualPaymentCard";
import { getRestaurantOrderReceiptRoute } from "@/lib/mobile-routes";
import {
  confirmRestaurantPayment,
  getRestaurantPaymentIntent,
  getRestaurantReceiptLink,
  startRestaurantAmanaPayment,
} from "@/services/restaurant-service";

export default function RestaurantOrderPayPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const orderId = params.id;

  const { data, isPending, isError } = useQuery({
    queryKey: ["restaurant-payment-intent", orderId],
    queryFn: () => getRestaurantPaymentIntent(orderId),
  });

  const mutation = useMutation({
    mutationFn: (providerReference: string) =>
      confirmRestaurantPayment(orderId, {
        provider_reference: providerReference || undefined,
      }),
    onSuccess: async (result) => {
      // Hors Amana, le serveur laisse le paiement en attente de verification admin.
      if (result.payment_status !== "paid") {
        return;
      }
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
          ? "Paiement initialise. Validez dans AmanaTa, puis cliquez sur Vérifier le paiement."
          : mutation.isSuccess
          ? mutation.data.payment_status === "paid"
            ? "Paiement confirme. Redirection..."
            : mutation.data.message
          : mutation.isError
            ? "Confirmation impossible. Réessayez."
            : ""
      }
      onConfirm={(providerReference) => mutation.mutate(providerReference)}
      onStart={() => startMutation.mutate()}
    />
  );
}
