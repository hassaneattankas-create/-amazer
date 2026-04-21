import { api } from "@/lib/api";
import { filterPublicRestaurantStorefronts } from "@/lib/public-catalog-filter";
import {
  PaymentConfirmPayload,
  PaymentConfirmResult,
  PaymentIntent,
  Receipt,
  ReceiptLink,
} from "@/types/order";
import {
  RestaurantMenuItem,
  RestaurantOrder,
  RestaurantOrderRequest,
  RestaurantReservation,
  RestaurantReservationRequest,
  RestaurantStorefront,
} from "@/types/restaurant";

export async function listRestaurantStorefronts(query?: string): Promise<RestaurantStorefront[]> {
  const response = await api.get<{ items: RestaurantStorefront[] }>("/api/v1/restaurant/storefronts", {
    params: query?.trim() ? { query: query.trim(), limit: 120 } : { limit: 120 },
  });
  return filterPublicRestaurantStorefronts(response.data.items);
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

export async function getRestaurantPaymentIntent(orderId: string): Promise<PaymentIntent> {
  const response = await api.get<PaymentIntent>(`/api/v1/restaurant/orders/${orderId}/payment-intent`);
  return response.data;
}

export async function confirmRestaurantPayment(
  orderId: string,
  payload: PaymentConfirmPayload
): Promise<PaymentConfirmResult> {
  const response = await api.post<PaymentConfirmResult>(`/api/v1/restaurant/orders/${orderId}/payment/confirm`, payload);
  return response.data;
}

export async function getRestaurantReceiptLink(orderId: string): Promise<ReceiptLink> {
  const response = await api.get<ReceiptLink>(`/api/v1/restaurant/orders/${orderId}/receipt-link`);
  return response.data;
}

export async function getRestaurantSecureReceipt(orderId: string, token?: string): Promise<Receipt> {
  const response = await api.get<Receipt>(`/api/v1/restaurant/receipt/${orderId}`, {
    params: token ? { token } : undefined,
  });
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

export async function listSellerRestaurantMenu(): Promise<RestaurantMenuItem[]> {
  const response = await api.get<RestaurantMenuItem[]>("/api/v1/restaurant/seller/menu");
  return response.data;
}

export async function updateSellerRestaurantMenuAvailability(
  menuItemId: string,
  isAvailable: boolean
): Promise<RestaurantMenuItem> {
  const response = await api.patch<RestaurantMenuItem>(
    `/api/v1/restaurant/seller/menu/${menuItemId}`,
    { is_available: isAvailable }
  );
  return response.data;
}

export async function createRestaurantReservation(
  vendorId: string,
  payload: RestaurantReservationRequest
): Promise<RestaurantReservation> {
  const response = await api.post<RestaurantReservation>(
    `/api/v1/seller/storefront/${vendorId}/restaurant-reservations`,
    payload
  );
  return response.data;
}

export async function listSellerRestaurantReservations(): Promise<RestaurantReservation[]> {
  const response = await api.get<RestaurantReservation[]>("/api/v1/seller/restaurant-reservations");
  return response.data;
}

export async function updateSellerRestaurantReservationStatus(
  reservationId: string,
  status: "pending" | "confirmed" | "declined"
): Promise<RestaurantReservation> {
  const response = await api.patch<RestaurantReservation>(
    `/api/v1/seller/restaurant-reservations/${reservationId}/status`,
    { status }
  );
  return response.data;
}
