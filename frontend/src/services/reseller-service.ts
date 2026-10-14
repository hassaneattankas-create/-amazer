import { api } from "@/lib/api";

export type ResellerListing = {
  id: string;
  price_id: string;
  product_id: string;
  product_name: string;
  image_url: string | null;
  supplier_amount: number;
  resale_amount: number;
  margin: number;
  in_stock: boolean;
  is_active: boolean;
  sales_count: number;
};

export type ResellerPublicItem = {
  id: string;
  price_id: string;
  vendor_id: string;
  product_id: string;
  product_name: string;
  image_url: string | null;
  price: number;
};

export type ResellerShop = { reseller_id: string; reseller_name: string; items: ResellerPublicItem[] };
export type ResellerEarnings = { earned: number; pending: number; orders_delivered: number; orders_pending: number };

export async function createResellerListing(payload: { price_id: string; resale_amount: number }) {
  return (await api.post<ResellerListing>("/api/v1/resellers/listings", payload)).data;
}

export async function listMyResellerListings() {
  return (await api.get<ResellerListing[]>("/api/v1/resellers/listings/me")).data;
}

export async function updateResellerListing(id: string, payload: { resale_amount?: number; is_active?: boolean }) {
  return (await api.patch<ResellerListing>(`/api/v1/resellers/listings/${id}`, payload)).data;
}

export async function deleteResellerListing(id: string) {
  await api.delete(`/api/v1/resellers/listings/${id}`);
}

export async function getMyResellerEarnings() {
  return (await api.get<ResellerEarnings>("/api/v1/resellers/earnings/me")).data;
}

export async function getResellerShop(resellerId: string) {
  return (await api.get<ResellerShop>(`/api/v1/resellers/${resellerId}/shop`)).data;
}
