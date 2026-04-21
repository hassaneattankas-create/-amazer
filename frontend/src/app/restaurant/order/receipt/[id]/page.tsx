"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { ReceiptView } from "@/components/order/ReceiptView";
import { getRestaurantSecureReceipt } from "@/services/restaurant-service";

export default function RestaurantOrderReceiptPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? undefined;
  const orderId = params.id;

  const { data, isPending, isError } = useQuery({
    queryKey: ["restaurant-secure-receipt", orderId, token],
    queryFn: () => getRestaurantSecureReceipt(orderId, token),
  });

  return <ReceiptView receipt={data} isPending={isPending} isError={isError} backHref="/restaurant" />;
}
