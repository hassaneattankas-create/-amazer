"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";

import { ManualPaymentCard } from "@/components/order/ManualPaymentCard";
import { confirmPayment, getPaymentIntent } from "@/services/order-service";

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
    onSuccess: () => {
      window.setTimeout(() => router.push(`/order/success/${orderId}`), 600);
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
