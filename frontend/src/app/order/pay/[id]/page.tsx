"use client";

import { useParams } from "next/navigation";

import { OrderPayFlow } from "@/components/order/OrderPayFlow";

export default function OrderPayPage() {
  const params = useParams<{ id: string }>();
  return <OrderPayFlow orderId={params.id} />;
}
