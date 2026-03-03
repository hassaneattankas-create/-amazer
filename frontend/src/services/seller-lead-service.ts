import { api } from "@/lib/api";

export type SellerLeadPayload = {
  shop_name: string;
  district: string;
  contact: string;
  product_type: string;
};

export async function createSellerLead(payload: SellerLeadPayload): Promise<{ id: string }> {
  const response = await api.post<{ id: string }>("/api/v1/seller/leads", payload);
  return response.data;
}
