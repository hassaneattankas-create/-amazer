import { api } from "@/lib/api";
import {
  SellerInventoryItem,
  SellerProductPayload,
  SellerProfile,
  SellerProfilePayload,
} from "@/types/seller";

type SellerProductCreateResponse = {
  product_id: string;
  price_id: string;
  vendor_id: string;
};

export async function getSellerProfile(): Promise<SellerProfile | null> {
  const response = await api.get<SellerProfile | null>("/api/v1/seller/profile");
  return response.data;
}

export async function upsertSellerProfile(payload: SellerProfilePayload): Promise<SellerProfile> {
  const response = await api.post<SellerProfile>("/api/v1/seller/profile", payload);
  return response.data;
}

export async function createSellerProduct(
  payload: SellerProductPayload
): Promise<SellerProductCreateResponse> {
  const response = await api.post<SellerProductCreateResponse>("/api/v1/seller/products", payload);
  return response.data;
}

export async function listSellerInventory(): Promise<SellerInventoryItem[]> {
  const response = await api.get<SellerInventoryItem[]>("/api/v1/seller/inventory");
  return response.data;
}

export async function updateSellerInventory(
  priceId: string,
  payload: {
    amount?: number;
    stock_quantity?: number;
    is_active?: boolean;
    promo_amount?: number;
    boost_duration_hours?: 24 | 168;
  }
): Promise<SellerInventoryItem> {
  const response = await api.patch<SellerInventoryItem>(`/api/v1/seller/inventory/${priceId}`, payload);
  return response.data;
}
