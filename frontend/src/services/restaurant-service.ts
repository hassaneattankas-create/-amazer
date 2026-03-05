import { api } from "@/lib/api";
import {
  RestaurantMenuItem,
  RestaurantOrder,
  RestaurantOrderRequest,
  RestaurantStorefront,
} from "@/types/restaurant";

export async function listRestaurantStorefronts(query?: string): Promise<RestaurantStorefront[]> {
  const response = await api.get<{ items: RestaurantStorefront[] }>("/api/v1/restaurant/storefronts", {
    params: query?.trim() ? { query: query.trim(), limit: 120 } : { limit: 120 },
  });
  return response.data.items;
}

export async function listRestaurantMenu(vendorId?: string): Promise<RestaurantMenuItem[]> {
  const response = await api.get<RestaurantMenuItem[]>("/api/v1/restaurant/menu", {
    params: vendorId ? { vendor_id: vendorId } : undefined,
  });
  return response.data;
}

export async function createRestaurantOrder(payload: RestaurantOrderRequest): Promise<RestaurantOrder> {
  const response = await api.post<RestaurantOrder>("/api/v1/restaurant/orders", payload);
  return response.data;
}

export async function listSellerRestaurantOrders(): Promise<RestaurantOrder[]> {
  const response = await api.get<RestaurantOrder[]>("/api/v1/restaurant/seller/orders");
  return response.data;
}

export async function updateSellerRestaurantOrderStatus(
  orderId: string,
  status: "commande" | "preparation" | "livraison" | "recu"
): Promise<RestaurantOrder> {
  const response = await api.patch<RestaurantOrder>(
    `/api/v1/restaurant/seller/orders/${orderId}/status`,
    { status }
  );
  return response.data;
}

export async function createRestaurantMenuItem(payload: {
  name: string;
  description?: string;
  image_url?: string;
  base_price: number;
  currency?: string;
  tags?: string[];
  options?: Array<{ name: string; price: number }>;
  estimated_prep_minutes?: number;
}): Promise<RestaurantMenuItem> {
  const response = await api.post<RestaurantMenuItem>("/api/v1/restaurant/menu", payload);
  return response.data;
}
