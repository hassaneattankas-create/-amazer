"use client";

import { useParams } from "next/navigation";

import { RestaurantPayFlow } from "@/components/order/RestaurantPayFlow";

export default function RestaurantOrderPayPage() {
  const params = useParams<{ id: string }>();
  return <RestaurantPayFlow orderId={params.id} />;
}
