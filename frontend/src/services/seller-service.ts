import { api } from "@/lib/api";
import {
  HotelBooking,
  HotelBookingRequest,
  HotelBookingStatus,
  MyBooking,
  RoomAvailability,
  SeatAvailability,
  SellerStats,
  TicketScanResult,
  VendorReviewItem,
  VendorReviews,
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
    barcode?: string;
    amount?: number;
    stock_quantity?: number;
    description?: string;
    main_image_url?: string;
    is_active?: boolean;
    promo_amount?: number;
    promo_days?: number;
    clear_promo?: boolean;
    is_digital?: boolean;
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

/** Statistiques : visite de la vitrine ou contact (appel, WhatsApp, message). */
export async function recordStorefrontEvent(vendorId: string, kind: "view" | "contact"): Promise<void> {
  await api.post(`/api/v1/seller/storefront/${vendorId}/events`, { kind });
}

/** Statistiques du vendeur : 7 jours (30 jours en Premium). */
export async function getSellerStats(): Promise<SellerStats> {
  return (await api.get<SellerStats>("/api/v1/seller/stats")).data;
}

/** Avis verifies d'un etablissement (public). */
export async function getVendorReviews(vendorId: string): Promise<VendorReviews> {
  return (await api.get<VendorReviews>(`/api/v1/seller/storefront/${vendorId}/reviews`)).data;
}

/** Donner ou modifier son avis (apres une commande livree, un sejour ou un voyage). */
export async function postVendorReview(vendorId: string, data: { rating: number; comment?: string }): Promise<VendorReviewItem> {
  return (await api.post<VendorReviewItem>(`/api/v1/seller/storefront/${vendorId}/reviews`, data)).data;
}

/** Avis recus par l'etablissement du vendeur connecte. */
export async function listMyShopReviews(): Promise<VendorReviews> {
  return (await api.get<VendorReviews>("/api/v1/seller/reviews")).data;
}

export async function replyToReview(reviewId: string, reply: string): Promise<VendorReviewItem> {
  return (await api.post<VendorReviewItem>(`/api/v1/seller/reviews/${reviewId}/reply`, { reply })).data;
}

/** Places restantes par heure de depart d'un trajet, un jour donne. */
export async function getTripSeats(vendorId: string, tripId: string, day: string): Promise<SeatAvailability> {
  const response = await api.get<SeatAvailability>(`/api/v1/seller/storefront/${vendorId}/seats`, { params: { trip_id: tripId, day } });
  return response.data;
}

/** Reservations du client connecte (hotels et trajets, billet a QR code). */
export async function listMyBookings(): Promise<MyBooking[]> {
  return (await api.get<MyBooking[]>("/api/v1/seller/my-bookings")).data;
}

/** Embarquement : scan du QR code d'un billet par le transporteur. */
export async function scanTicket(token: string): Promise<TicketScanResult> {
  return (await api.post<TicketScanResult>("/api/v1/seller/tickets/scan", { token })).data;
}

/** Chambres libres par type pour des dates (aucune connexion requise). */
export async function getRoomAvailability(vendorId: string, checkIn: string, checkOut: string): Promise<RoomAvailability> {
  const response = await api.get<RoomAvailability>(`/api/v1/seller/storefront/${vendorId}/availability`, {
    params: { check_in: checkIn, check_out: checkOut },
  });
  return response.data;
}

export async function listSellerHotelBookings(): Promise<HotelBooking[]> {
  const response = await api.get<HotelBooking[]>("/api/v1/seller/hotel-bookings");
  return response.data;
}

export async function updateSellerHotelBookingStatus(
  bookingId: string,
  status: HotelBookingStatus,
): Promise<HotelBooking> {
  const response = await api.patch<HotelBooking>(
    `/api/v1/seller/hotel-bookings/${bookingId}/status`,
    {
      status,
    },
  );
  return response.data;
}

/** Ligne du relevé : une commande et ce qui revient à la boutique. */
export type SellerEarningLine = {
  order_id: string;
  tracking_code: string | null;
  created_at: string | null;
  /** paid : reçu · due : à recevoir · waiting : pas encore livrée · blocked : litige ou remboursement */
  state: "paid" | "due" | "waiting" | "blocked";
  amount: number;
  commission_rate: number;
  commission: number;
  net: number;
  paid_out_at: string | null;
};

/** Formule de la boutique (gratuite ou abonnement) et argent de ses ventes. */
export type SellerPlanEarnings = {
  plan: "free" | "subscribed" | "inactive";
  /** Seules les boutiques (hors restaurants et Premium) ont une formule gratuite. */
  eligible_free_plan: boolean;
  max_visible_products: number | null;
  visible_products: number;
  commission_rate: number;
  free_plan_commission_rate: number;
  free_plan_max_products: number;
  subscription_paid_until: string | null;
  to_receive: number;
  awaiting_delivery: number;
  received: number;
  commission_total: number;
  lines: SellerEarningLine[];
};

export async function getSellerPlanEarnings(): Promise<SellerPlanEarnings> {
  const response = await api.get<SellerPlanEarnings>("/api/v1/seller/plan-earnings");
  return response.data;
}

export async function getSellerSubscriptionStatus(): Promise<SellerSubscriptionStatus> {
  const response = await api.get<SellerSubscriptionStatus>("/api/v1/seller/subscription-status");
  return response.data;
}

export async function paySellerSubscription(payload: {
  payment_mode: string;
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
