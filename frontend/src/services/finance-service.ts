import axios from "axios";
import { getBackendOriginFromEnv, getMobileSiteOriginFromEnv } from "@/lib/backend-origin";
import { adminProxyRequest } from "@/lib/admin-proxy-client";
import {
  api,
  clearAdminFinanceVerified,
  getClientAccessToken,
  getClientCookieValue,
  persistAdminFinanceVerified,
} from "@/lib/api";
import { isMobileAppBuild } from "@/lib/mobile-app";
import {
  AdminPendingSeller,
  AdminSeller,
  AdminSellerPricingPayload,
  AdminSellerSubscriptionPaymentRequest,
  AdminUser,
  AdminUserStats,
  AdminOrderTracking,
  AuditLogItem,
  CountersResetResult,
  DistrictFeeItem,
  FinanceSettings,
  FinanceSummary,
  PublicContactInfo,
  TransferPayload,
  TransferResult,
  TreasuryTransaction,
  VerifyPinPayload,
  WalletSummary,
} from "@/types/finance";

function getAdminFinancePinVerifyUrl(): string {
  if (!isMobileAppBuild()) {
    return "/api/admin-finance/pin/verify";
  }
  const site = getMobileSiteOriginFromEnv();
  if (site) {
    return `${site.replace(/\/$/, "")}/api/admin-finance/pin/verify`;
  }
  return `${getBackendOriginFromEnv()}/api/v1/admin/finance/pin/verify`;
}

function getAdminFinanceAuditExportUrl(): string {
  if (!isMobileAppBuild()) {
    return "/api/admin-proxy/admin/finance/audit-history/export";
  }
  const site = getMobileSiteOriginFromEnv();
  if (site) {
    return `${site.replace(/\/$/, "")}/api/admin-proxy/admin/finance/audit-history/export`;
  }
  return `${getBackendOriginFromEnv()}/api/v1/admin/finance/audit-history/export`;
}

export async function getPublicFinanceSettings(): Promise<FinanceSettings> {
  const response = await api.get<FinanceSettings>("/api/v1/admin/finance/public-settings");
  return response.data;
}

export type PublicDistrictFee = { district_name: string; delivery_fee: number };

export async function getPublicDistrictFees(): Promise<PublicDistrictFee[]> {
  const response = await api.get<PublicDistrictFee[]>("/api/v1/admin/finance/public-district-fees");
  return response.data;
}

export async function getPublicContactInfo(): Promise<PublicContactInfo> {
  const response = await api.get<PublicContactInfo>("/api/v1/admin/finance/contact-info");
  return response.data;
}

export async function getAdminFinanceSettings(): Promise<FinanceSettings> {
  return adminProxyRequest<FinanceSettings>({
    url: "/admin/finance/settings",
    method: "GET",
  });
}

export async function updateAdminFinanceSettings(payload: FinanceSettings): Promise<FinanceSettings> {
  return adminProxyRequest<FinanceSettings>({
    url: "/admin/finance/settings",
    method: "PUT",
    data: payload,
  });
}

export async function getAdminFinanceSummary(): Promise<FinanceSummary> {
  return adminProxyRequest<FinanceSummary>({
    url: "/admin/finance/summary",
    method: "GET",
  });
}

export async function verifyAdminFinancePin(payload: VerifyPinPayload): Promise<void> {
  const headers: Record<string, string> = {};
  const accessToken = getClientAccessToken();
  const csrfToken = getClientCookieValue("csrf_token");
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }
  try {
    const response = await axios.post<{ token?: string; expires_in?: number }>(getAdminFinancePinVerifyUrl(), payload, {
      headers,
      withCredentials: true,
      timeout: 30000,
    });
    if (!response.data?.token) {
      throw new Error("Vérification du PIN impossible.");
    }
    persistAdminFinanceVerified(response.data.token, response.data.expires_in);
  } catch (error) {
    clearAdminFinanceVerified();
    throw error;
  }
}

export async function getAdminWalletSummary(): Promise<WalletSummary> {
  return adminProxyRequest<WalletSummary>({
    url: "/admin/finance/wallet-summary",
    method: "GET",
  });
}

export async function getAdminTreasuryHistory(): Promise<TreasuryTransaction[]> {
  return adminProxyRequest<TreasuryTransaction[]>({
    url: "/admin/finance/treasury-history",
    method: "GET",
  });
}

export async function createAdminTransfer(payload: TransferPayload): Promise<TransferResult> {
  return adminProxyRequest<TransferResult>({
    url: "/admin/finance/transfer",
    method: "POST",
    data: payload,
  });
}

export async function resetAdminFinanceCounters(): Promise<CountersResetResult> {
  return adminProxyRequest<CountersResetResult>({
    url: "/admin/finance/reset-counters",
    method: "POST",
  });
}

export async function listAdminOrders(limit = 40): Promise<AdminOrderTracking[]> {
  return adminProxyRequest<AdminOrderTracking[]>({
    url: "/admin/finance/orders",
    method: "GET",
    params: { limit },
  });
}

export async function dispatchAdminOrder(
  orderId: string,
  status: AdminOrderTracking["status"] = "livraison"
): Promise<AdminOrderTracking> {
  return adminProxyRequest<AdminOrderTracking>({
    url: `/admin/finance/orders/${orderId}/dispatch`,
    method: "POST",
    data: { status },
  });
}

export async function cancelAdminOrder(orderId: string): Promise<AdminOrderTracking> {
  return adminProxyRequest<AdminOrderTracking>({
    url: `/admin/finance/orders/${orderId}/cancel`,
    method: "POST",
  });
}

export async function listAdminDistrictFees(): Promise<DistrictFeeItem[]> {
  return adminProxyRequest<DistrictFeeItem[]>({
    url: "/admin/finance/district-fees",
    method: "GET",
  });
}

export async function replaceAdminDistrictFees(payload: DistrictFeeItem[]): Promise<DistrictFeeItem[]> {
  return adminProxyRequest<DistrictFeeItem[]>({
    url: "/admin/finance/district-fees",
    method: "PUT",
    data: payload,
  });
}

export async function toggleLaunchMode(enabled: boolean): Promise<FinanceSettings> {
  return adminProxyRequest<FinanceSettings>({
    url: "/admin/finance/mode-launch",
    method: "POST",
    params: { enabled },
  });
}

export async function listAdminAuditHistory(limit = 120): Promise<AuditLogItem[]> {
  return adminProxyRequest<AuditLogItem[]>({
    url: "/admin/finance/audit-history",
    method: "GET",
    params: { limit },
  });
}

export async function listAdminSellers(): Promise<AdminSeller[]> {
  return adminProxyRequest<AdminSeller[]>({
    url: "/admin/finance/sellers",
    method: "GET",
  });
}

export async function deleteAdminSeller(profileId: string): Promise<void> {
  await adminProxyRequest<void>({
    url: `/admin/finance/sellers/${profileId}`,
    method: "DELETE",
  });
}

export async function restoreAdminSeller(profileId: string): Promise<AdminSeller> {
  return adminProxyRequest<AdminSeller>({
    url: `/admin/finance/sellers/${profileId}/restore`,
    method: "POST",
  });
}

export async function permanentlyDeleteAdminSeller(profileId: string): Promise<void> {
  await adminProxyRequest<void>({
    url: `/admin/finance/sellers/${profileId}/permanent-delete`,
    method: "POST",
  });
}

export async function verifyAdminSeller(profileId: string, verified: boolean): Promise<AdminSeller> {
  return adminProxyRequest<AdminSeller>({
    url: `/admin/finance/sellers/${profileId}/verify`,
    method: "POST",
    params: { verified },
  });
}

export async function updateAdminSellerPricing(
  profileId: string,
  payload: AdminSellerPricingPayload,
): Promise<AdminSeller> {
  return adminProxyRequest<AdminSeller>({
    url: `/admin/finance/sellers/${profileId}/pricing`,
    method: "PUT",
    data: payload,
  });
}

export async function updateAdminSellerType(
  profileId: string,
  payload: { activity_type: string; storefront_tier: string },
): Promise<AdminSeller> {
  return adminProxyRequest<AdminSeller>({
    url: `/admin/finance/sellers/${profileId}/type`,
    method: "PUT",
    data: payload,
  });
}

export async function setAdminSellerEnterprise(profileId: string, enabled: boolean): Promise<AdminSeller> {
  return adminProxyRequest<AdminSeller>({
    url: `/admin/finance/sellers/${profileId}/enterprise`,
    method: "POST",
    params: { enabled },
  });
}

export async function setAdminSellerTransport(profileId: string, enabled: boolean): Promise<AdminSeller> {
  return adminProxyRequest<AdminSeller>({
    url: `/admin/finance/sellers/${profileId}/transport`,
    method: "POST",
    params: { enabled },
  });
}

/** Choix unique de l'activité (Boutique, Restaurant, ou Premium : entreprise, transport, pharmacie, station). */
export async function setAdminSellerActivity(
  profileId: string,
  activity: "shop" | "restaurant" | "premium" | "transport" | "pharmacy" | "fuel_station"
): Promise<AdminSeller> {
  return adminProxyRequest<AdminSeller>({
    url: `/admin/finance/sellers/${profileId}/activity`,
    method: "POST",
    params: { activity },
  });
}

/** Pharmacie, station-essence ou vitrine normale (« none »). */
export async function setAdminSellerServiceKind(profileId: string, kind: "pharmacy" | "fuel_station" | "none"): Promise<AdminSeller> {
  return adminProxyRequest<AdminSeller>({
    url: `/admin/finance/sellers/${profileId}/service-kind`,
    method: "POST",
    params: { kind },
  });
}

export async function grantAdminSellerSubscription(profileId: string, months = 1): Promise<AdminSeller> {
  return adminProxyRequest<AdminSeller>({
    url: `/admin/finance/sellers/${profileId}/grant-subscription`,
    method: "POST",
    params: { months },
  });
}

export async function getAdminUserStats(): Promise<AdminUserStats> {
  return adminProxyRequest<AdminUserStats>({
    url: "/admin/finance/users/stats",
    method: "GET",
  });
}

export async function listAdminUsers(query?: string, limit = 200): Promise<AdminUser[]> {
  return adminProxyRequest<AdminUser[]>({
    url: "/admin/finance/users",
    method: "GET",
    params: { query, limit },
  });
}

export async function removeAdminUser(userId: string): Promise<void> {
  await adminProxyRequest<void>({
    url: `/admin/finance/users/${userId}`,
    method: "DELETE",
  });
}

export async function permanentlyDeleteAdminUser(userId: string): Promise<void> {
  await adminProxyRequest<void>({
    url: `/admin/finance/users/${userId}/permanent-delete`,
    method: "POST",
  });
}

export type AdminResellerEarning = {
  user_id: string;
  full_name: string;
  contact: string;
  whatsapp_phone: string | null;
  earned: number;
  pending: number;
  orders_delivered: number;
};

export async function listResellerEarnings(): Promise<AdminResellerEarning[]> {
  return adminProxyRequest<AdminResellerEarning[]>({ url: "/admin/finance/reseller-earnings", method: "GET" });
}

export type AdminResellerPayment = {
  id: string;
  user_id: string;
  full_name: string;
  contact: string;
  payment_mode: string;
  transaction_reference: string;
  months: number;
  amount_claimed: number;
  status: string;
  created_at: string;
};

export async function listResellerPayments(): Promise<AdminResellerPayment[]> {
  return adminProxyRequest<AdminResellerPayment[]>({ url: "/admin/finance/reseller-payments", method: "GET" });
}

export async function decideResellerPayment(id: string, decision: "approved" | "rejected"): Promise<AdminResellerPayment> {
  return adminProxyRequest<AdminResellerPayment>({
    url: `/admin/finance/reseller-payments/${id}/decision`,
    method: "POST",
    data: { decision },
  });
}

export type AdminAffiliateEarning = {
  user_id: string;
  full_name: string;
  contact: string;
  whatsapp_phone: string | null;
  code: string;
  tier: "affiliate" | "ambassador";
  status: "active" | "suspended";
  clicks: number;
  referred: number;
  flagged_referrals: number;
  earned: number;
  pending: number;
  on_hold: number;
  review: number;
  available: number;
  requested: number;
  paid: number;
  orders_delivered: number;
  ambassador_applied_at: string | null;
  ambassador_application: string | null;
  admin_note: string | null;
};

export type AffiliateEarningStatus = "pending" | "review" | "available" | "requested" | "paid" | "cancelled";

export type AdminAffiliateLedgerLine = {
  id: string;
  kind: "seller_subscription" | "customer_bonus" | "bonus";
  amount: number;
  status: AffiliateEarningStatus;
  percent: number | null;
  note: string | null;
  source_name: string | null;
  reference: string;
  created_at: string;
  available_at: string | null;
};

export type AdminAffiliatePayout = {
  id: string;
  user_id: string;
  full_name: string;
  tier: "affiliate" | "ambassador";
  amount: number;
  method: string;
  phone: string;
  status: "requested" | "paid" | "rejected";
  transaction_reference: string | null;
  admin_note: string | null;
  review_amount: number;
  created_at: string;
  processed_at: string | null;
};

export async function listAffiliateEarnings(): Promise<AdminAffiliateEarning[]> {
  return adminProxyRequest<AdminAffiliateEarning[]>({ url: "/admin/finance/affiliate-earnings", method: "GET" });
}

export async function getAffiliateLedger(userId: string): Promise<AdminAffiliateLedgerLine[]> {
  return adminProxyRequest<AdminAffiliateLedgerLine[]>({ url: `/admin/finance/affiliates/${userId}/ledger`, method: "GET" });
}

export async function updateAffiliate(
  userId: string,
  data: {
    tier?: "affiliate" | "ambassador";
    status?: "active" | "suspended";
    admin_note?: string;
    cancel_unpaid?: boolean;
    reason?: string;
  }
): Promise<AdminAffiliateEarning> {
  return adminProxyRequest<AdminAffiliateEarning>({ url: `/admin/finance/affiliates/${userId}`, method: "POST", data });
}

export async function decideAffiliateEarning(
  earningId: string,
  data: { action: "approve" | "cancel"; note?: string }
): Promise<AdminAffiliateLedgerLine> {
  return adminProxyRequest<AdminAffiliateLedgerLine>({ url: `/admin/finance/affiliate-ledger/${earningId}`, method: "POST", data });
}

export async function giveAffiliateBonus(userId: string, data: { amount: number; reason: string }): Promise<void> {
  await adminProxyRequest<void>({ url: `/admin/finance/affiliates/${userId}/bonus`, method: "POST", data });
}

export async function listAffiliatePayouts(
  status: "requested" | "paid" | "rejected" | "all" = "requested"
): Promise<AdminAffiliatePayout[]> {
  return adminProxyRequest<AdminAffiliatePayout[]>({ url: `/admin/finance/affiliate-payouts?status=${status}`, method: "GET" });
}

export async function decideAffiliatePayout(
  payoutId: string,
  data: { action: "paid" | "rejected"; transaction_reference?: string; note?: string; cancel_earnings?: boolean }
): Promise<AdminAffiliatePayout> {
  return adminProxyRequest<AdminAffiliatePayout>({ url: `/admin/finance/affiliate-payouts/${payoutId}`, method: "POST", data });
}

export type AdminRefund = {
  id: string;
  source: "order" | "restaurant_order";
  source_id: string;
  customer_name: string;
  phone: string | null;
  method: string | null;
  amount: number;
  reason: string;
  status: "to_refund" | "refunded" | "not_needed";
  reference: string | null;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
};

export async function listRefunds(status: "to_refund" | "refunded" | "not_needed" | "all" = "to_refund"): Promise<AdminRefund[]> {
  return adminProxyRequest<AdminRefund[]>({ url: `/admin/finance/refunds?status=${status}`, method: "GET" });
}

export async function decideRefund(
  id: string,
  data: { action: "refunded" | "not_needed"; reference?: string; note?: string }
): Promise<AdminRefund> {
  return adminProxyRequest<AdminRefund>({ url: `/admin/finance/refunds/${id}`, method: "POST", data });
}

export type AdminMessageAudience = "all" | "customers" | "sellers" | "couriers" | "user";

/** Message de l'equipe : notification sur le site + e-mail automatique. */
export async function sendAdminMessage(payload: {
  audience: AdminMessageAudience;
  user_email?: string;
  title: string;
  body: string;
  href?: string;
}): Promise<{ recipients: number }> {
  return adminProxyRequest<{ recipients: number }>({ url: "/admin/finance/messages", method: "POST", data: payload });
}

export type AdminUserRole = "user" | "admin" | "courier";

export async function updateAdminUserRole(userId: string, role: AdminUserRole): Promise<AdminUser> {
  return adminProxyRequest<AdminUser>({
    url: `/admin/finance/users/${userId}/role`,
    method: "PATCH",
    data: { role },
  });
}

export async function restoreAdminUser(userId: string): Promise<AdminUser> {
  return adminProxyRequest<AdminUser>({
    url: `/admin/finance/users/${userId}/restore`,
    method: "POST",
  });
}

export async function listAdminSellerSubscriptionPayments(
  status: "pending" | "approved" | "rejected" | "all" = "pending",
  limit = 100
): Promise<AdminSellerSubscriptionPaymentRequest[]> {
  return adminProxyRequest<AdminSellerSubscriptionPaymentRequest[]>({
    url: "/admin/finance/seller-subscription-payments",
    method: "GET",
    params: { status, limit },
  });
}

export async function decideAdminSellerSubscriptionPayment(
  paymentId: string,
  payload: { decision: "approved" | "rejected"; admin_note?: string }
): Promise<AdminSellerSubscriptionPaymentRequest> {
  return adminProxyRequest<AdminSellerSubscriptionPaymentRequest>({
    url: `/admin/finance/seller-subscription-payments/${paymentId}/decision`,
    method: "POST",
    data: payload,
  });
}

export async function listAdminPendingSellers(status = "pending"): Promise<AdminPendingSeller[]> {
  return adminProxyRequest<AdminPendingSeller[]>({
    url: "/admin/finance/seller-pre-registrations",
    method: "GET",
    params: { status_filter: status },
  });
}

export async function decideAdminPendingSeller(
  regId: string,
  payload: { decision: "approved" | "rejected"; admin_note?: string }
): Promise<AdminPendingSeller> {
  return adminProxyRequest<AdminPendingSeller>({
    url: `/admin/finance/seller-pre-registrations/${regId}/decide`,
    method: "POST",
    data: payload,
  });
}

export async function downloadAuditCsv(limit = 1000): Promise<Blob> {
  const response = await axios.get(getAdminFinanceAuditExportUrl(), {
    params: { limit },
    responseType: "blob",
    withCredentials: true,
    timeout: 10000,
    headers: {
      ...(getClientAccessToken() ? { Authorization: `Bearer ${getClientAccessToken()}` } : {}),
    },
  });
  return response.data as Blob;
}
