"use client";

import { useParams } from "next/navigation";

import { ResellerShopView } from "@/components/reseller/ResellerShopView";

export default function ResellerShopPage() {
  const params = useParams<{ id: string }>();
  return <ResellerShopView resellerId={params.id} />;
}
