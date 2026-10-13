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
