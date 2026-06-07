import { api } from "@/lib/api";
import {
  HotelBooking,
  HotelBookingRequest,
  SellerInventoryItem,
  SellerShopOrder,
  SellerShopOrderStatus,
  SellerProductPayload,
  SellerProfile,
  SellerSubscriptionPaymentRequest,
  SellerProfilePayload,
  SellerSubscriptionStatus,
  SellerStorefront,
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

export async function upsertSellerProfile(
  payload: SellerProfilePayload,
): Promise<SellerProfile> {
  const response = await api.post<SellerProfile>("/api/v1/seller/profile", payload);
  return response.data;
}

export async function createSellerProduct(
  payload: SellerProductPayload,
): Promise<SellerProductCreateResponse> {
  const response = await api.post<SellerProductCreateResponse>(
    "/api/v1/seller/products",
    payload,
  );
  return response.data;
}

export async function listSellerInventory(): Promise<SellerInventoryItem[]> {
  const response = await api.get<SellerInventoryItem[]>("/api/v1/seller/inventory");
  return response.data;
}

export async function updateSellerInventory(
  priceId: string,
  payload: {
    product_name?: string;
    brand?: string;
    category_id?: string;
    amount?: number;
    stock_quantity?: number;
    description?: string;
    main_image_url?: string;
    is_active?: boolean;
    promo_amount?: number;
  },
): Promise<SellerInventoryItem> {
  const response = await api.patch<SellerInventoryItem>(
    `/api/v1/seller/inventory/${priceId}`,
    payload,
  );
  return response.data;
}

export async function deleteSellerInventoryItem(priceId: string): Promise<void> {
  await api.delete(`/api/v1/seller/inventory/${priceId}`);
}

export async function listSellerOrders(): Promise<SellerShopOrder[]> {
  const response = await api.get<SellerShopOrder[]>("/api/v1/seller/orders");
  return response.data;
}

export async function updateSellerOrderStatus(
  orderId: string,
  status: SellerShopOrderStatus
): Promise<SellerShopOrder> {
  const response = await api.patch<SellerShopOrder>(`/api/v1/seller/orders/${orderId}/status`, {
    status,
  });
  return response.data;
}

export async function getSellerStorefront(vendorId: string): Promise<SellerStorefront> {
  const response = await api.get<SellerStorefront>(`/api/v1/seller/storefront/${vendorId}`);
  return response.data;
}

export async function createHotelBooking(
  vendorId: string,
  payload: HotelBookingRequest,
): Promise<HotelBooking> {
  const response = await api.post<HotelBooking>(
    `/api/v1/seller/storefront/${vendorId}/hotel-bookings`,
    payload,
  );
  return response.data;
}

export async function listSellerHotelBookings(): Promise<HotelBooking[]> {
  const response = await api.get<HotelBooking[]>("/api/v1/seller/hotel-bookings");
  return response.data;
}

export async function updateSellerHotelBookingStatus(
  bookingId: string,
  status: "pending" | "confirmed" | "cancelled",
): Promise<HotelBooking> {
  const response = await api.patch<HotelBooking>(
    `/api/v1/seller/hotel-bookings/${bookingId}/status`,
    {
      status,
    },
  );
  return response.data;
}

export async function getSellerSubscriptionStatus(): Promise<SellerSubscriptionStatus> {
  const response = await api.get<SellerSubscriptionStatus>("/api/v1/seller/subscription-status");
  return response.data;
}

export async function paySellerSubscription(payload: {
  payment_mode: "nita" | "amana";
  transaction_reference?: string;
  months: number;
}): Promise<SellerSubscriptionStatus> {
  const response = await api.post<SellerSubscriptionStatus>("/api/v1/seller/subscription/pay", payload);
  return response.data;
}

export async function listSellerSubscriptionPaymentRequests(): Promise<SellerSubscriptionPaymentRequest[]> {
  const response = await api.get<SellerSubscriptionPaymentRequest[]>("/api/v1/seller/subscription/payment-requests");
  return response.data;
}

export async function importSellerProductsCsv(file: File): Promise<{ created: number; errors: string[] }> {
  const form = new FormData();
  form.append("file", file);
  const response = await api.post<{ created: number; errors: string[] }>(
    "/api/v1/seller/products/import",
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data;
}

export async function importSellerProductPhotos(
  files: File[],
): Promise<{ created: number; errors: string[] }> {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  const response = await api.post<{ created: number; errors: string[] }>(
    "/api/v1/seller/products/import-photos",
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data;
}

export async function exportSellerOrdersCsv(): Promise<void> {
  const response = await api.get("/api/v1/seller/orders/export", { responseType: "blob" });
  const blob = new Blob([response.data as BlobPart], { type: "text/plain;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ventes_amazer_${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
