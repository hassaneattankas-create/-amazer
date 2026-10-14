"use client";

import { useParams } from "next/navigation";

import { OrderConfirmation } from "@/components/order/OrderConfirmation";

export default function OrderSuccessPage() {
  const params = useParams<{ id: string }>();
  return <OrderConfirmation orderId={params.id} />;
}
