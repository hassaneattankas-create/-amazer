"use client";

import { useParams } from "next/navigation";

import { ShopView } from "@/components/storefront/ShopView";

export default function VendorShopPage() {
  const params = useParams<{ vendorId: string }>();
  return <ShopView vendorId={params.vendorId} />;
}
