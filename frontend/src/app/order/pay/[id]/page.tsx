"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";

import { ManualPaymentCard } from "@/components/order/ManualPaymentCard";
import { confirmPayment, getPaymentIntent, startAmanaPayment } from "@/services/order-service";

export default function OrderPayPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const orderId = params.id;

  const { data, isPending, isError } = useQuery({
    queryKey: ["payment-intent", orderId],
    queryFn: () => getPaymentIntent(orderId),
  });

  const mutation = useMutation({
    mutationFn: (providerReference: string) =>
      confirmPayment(orderId, {
        provider_reference: providerReference || undefined,
      }),
    onSuccess: (result) => {
      // Hors Amana, le serveur laisse le paiement en attente de verification admin.
      if (result.payment_status !== "paid") {
        return;
      }
      window.setTimeout(() => router.push(`/order/success/${orderId}`), 600);
    },
  });
  const startMutation = useMutation({ mutationFn: () => startAmanaPayment(orderId) });

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
