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
    await axios.post(getAdminFinancePinVerifyUrl(), payload, {
      headers,
      withCredentials: true,
      timeout: 30000,
    });
    persistAdminFinanceVerified();
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
