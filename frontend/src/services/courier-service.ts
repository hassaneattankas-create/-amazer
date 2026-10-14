import { api } from "@/lib/api";
import type { ReceiptVerifyResult } from "@/types/order";

export type CourierPickup = {
  shop_name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  items: string[];
};

export type CourierOrder = {
  id: string;
  tracking_code: string | null;
  status: string;
  created_at: string;
  delivery_type: "standard" | "express_niamey" | string;
  district: string | null;
  total_amount: number;
  payment_status: string;
  item_count: number;
  pickups: CourierPickup[];
  customer_name: string;
  /** Visible seulement apres la prise en charge. */
  customer_phone: string | null;
  delivery_address: string | null;
  assigned_to_me: boolean;
  courier_assigned_at: string | null;
  delivered_at: string | null;
};

export async function listAvailableDeliveries(): Promise<CourierOrder[]> {
  return (await api.get<CourierOrder[]>("/api/v1/courier/orders/available")).data;
}

export async function listMyDeliveries(): Promise<CourierOrder[]> {
  return (await api.get<CourierOrder[]>("/api/v1/courier/orders/mine")).data;
}

export async function takeDelivery(orderId: string): Promise<CourierOrder> {
  return (await api.post<CourierOrder>(`/api/v1/courier/orders/${orderId}/take`)).data;
}

export async function markDelivered(orderId: string): Promise<CourierOrder> {
  return (await api.post<CourierOrder>(`/api/v1/courier/orders/${orderId}/delivered`)).data;
}

export async function releaseDelivery(orderId: string): Promise<CourierOrder> {
  return (await api.post<CourierOrder>(`/api/v1/courier/orders/${orderId}/release`)).data;
}

/** Confirme la livraison en scannant le QR code du reçu client (URL complete ou jeton seul). */
export async function scanDeliveryReceipt(raw: string): Promise<ReceiptVerifyResult> {
  let token = raw.trim();
  try {
    token = new URL(token).searchParams.get("token") ?? token;
  } catch {
    // deja un jeton
  }
  return (await api.post<ReceiptVerifyResult>("/api/v1/orders/receipt/verify", { token })).data;
}
