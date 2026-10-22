import { adminProxyRequest } from "@/lib/admin-proxy-client";

export type ConversationReport = {
  id: string;
  created_at: string;
  reporter_email: string | null;
  reporter_role: "customer" | "seller" | null;
  reason: string;
  conversation_id: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
};

export type ModeratedProduct = {
  price_id: string;
  product_name: string;
  vendor_name: string;
  amount: number;
  stock_quantity: number;
  is_active: boolean;
  hidden_by_admin: boolean;
};

export type AdminVendorReview = {
  id: string;
  author: string;
  rating: number;
  comment: string | null;
  reply: string | null;
  created_at: string;
  vendor_name: string;
  is_hidden: boolean;
};

export type AdminPlatformFeedback = {
  id: string;
  full_name: string;
  email: string | null;
  message: string;
  rating: number;
  created_at: string;
  is_visible: boolean;
};

/** Avis de la page publique « Avis » (sur AMAZER), visibles ou masqués. */
export async function listPlatformFeedbackAdmin(): Promise<AdminPlatformFeedback[]> {
  return adminProxyRequest<AdminPlatformFeedback[]>({ url: "/admin/feedback", method: "GET" });
}

export async function togglePlatformFeedback(id: string): Promise<void> {
  await adminProxyRequest({ url: `/admin/feedback/${id}/toggle`, method: "POST" });
}

/** 100 derniers avis sur les etablissements. */
export async function listVendorReviewsAdmin(): Promise<AdminVendorReview[]> {
  return adminProxyRequest<AdminVendorReview[]>({ url: "/seller/admin/reviews", method: "GET" });
}

/** Masquer ou reafficher un avis. */
export async function toggleVendorReview(id: string): Promise<void> {
  await adminProxyRequest({ url: `/seller/reviews/${id}/hide`, method: "POST" });
}

export async function listConversationReports(): Promise<ConversationReport[]> {
  return adminProxyRequest<ConversationReport[]>({ url: "/admin/moderation/reports", method: "GET" });
}

export async function searchModeratedProducts(query: string, hiddenOnly: boolean): Promise<ModeratedProduct[]> {
  return adminProxyRequest<ModeratedProduct[]>({
    url: "/admin/moderation/products",
    method: "GET",
    params: { query, hidden_only: hiddenOnly },
  });
}

export async function setProductVisibility(priceId: string, visible: boolean, reason: string): Promise<ModeratedProduct> {
  return adminProxyRequest<ModeratedProduct>({
    url: `/admin/moderation/products/${priceId}/visibility`,
    method: "POST",
    data: { visible, reason },
  });
}
