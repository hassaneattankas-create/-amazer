import axios from "axios";
import { api, getClientAccessToken, getClientCookieValue } from "@/lib/api";
import {
  AdminSeller,
  AdminSellerPricingPayload,
  AdminUser,
  AdminUserStats,
  AdminOrderTracking,
  AuditLogItem,
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

export async function getPublicFinanceSettings(): Promise<FinanceSettings> {
  const response = await api.get<FinanceSettings>("/api/v1/admin/finance/public-settings");
  return response.data;
}

export async function getPublicContactInfo(): Promise<PublicContactInfo> {
  const response = await api.get<PublicContactInfo>("/api/v1/admin/finance/contact-info");
  return response.data;
}

export async function getAdminFinanceSettings(): Promise<FinanceSettings> {
  const response = await api.get<FinanceSettings>("/api/v1/admin/finance/settings");
  return response.data;
}

export async function updateAdminFinanceSettings(payload: FinanceSettings): Promise<FinanceSettings> {
  const response = await api.put<FinanceSettings>("/api/v1/admin/finance/settings", payload);
  return response.data;
}

export async function getAdminFinanceSummary(): Promise<FinanceSummary> {
  const response = await api.get<FinanceSummary>("/api/v1/admin/finance/summary");
  return response.data;
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
  await axios.post("/api/admin-finance/pin/verify", payload, {
    headers,
    withCredentials: true,
    timeout: 10000,
  });
}

export async function getAdminWalletSummary(): Promise<WalletSummary> {
  const response = await api.get<WalletSummary>("/api/v1/admin/finance/wallet-summary");
  return response.data;
}

export async function getAdminTreasuryHistory(): Promise<TreasuryTransaction[]> {
  const response = await api.get<TreasuryTransaction[]>("/api/v1/admin/finance/treasury-history");
  return response.data;
}

export async function createAdminTransfer(payload: TransferPayload): Promise<TransferResult> {
  const response = await api.post<TransferResult>("/api/v1/admin/finance/transfer", payload);
  return response.data;
}

export async function listAdminOrders(limit = 40): Promise<AdminOrderTracking[]> {
  const response = await api.get<AdminOrderTracking[]>("/api/v1/admin/finance/orders", {
    params: { limit },
  });
  return response.data;
}

export async function dispatchAdminOrder(
  orderId: string,
  status: AdminOrderTracking["status"] = "livraison"
): Promise<AdminOrderTracking> {
  const response = await api.post<AdminOrderTracking>(`/api/v1/admin/finance/orders/${orderId}/dispatch`, {
    status,
  });
  return response.data;
}

export async function listAdminDistrictFees(): Promise<DistrictFeeItem[]> {
  const response = await api.get<DistrictFeeItem[]>("/api/v1/admin/finance/district-fees");
  return response.data;
}

export async function replaceAdminDistrictFees(payload: DistrictFeeItem[]): Promise<DistrictFeeItem[]> {
  const response = await api.put<DistrictFeeItem[]>("/api/v1/admin/finance/district-fees", payload);
  return response.data;
}

export async function toggleLaunchMode(enabled: boolean): Promise<FinanceSettings> {
  const response = await api.post<FinanceSettings>("/api/v1/admin/finance/mode-launch", null, {
    params: { enabled },
  });
  return response.data;
}

export async function listAdminAuditHistory(limit = 120): Promise<AuditLogItem[]> {
  const response = await api.get<AuditLogItem[]>("/api/v1/admin/finance/audit-history", {
    params: { limit },
  });
  return response.data;
}

export async function listAdminSellers(): Promise<AdminSeller[]> {
  const response = await api.get<AdminSeller[]>("/api/v1/admin/finance/sellers");
  return response.data;
}

export async function deleteAdminSeller(profileId: string): Promise<void> {
  await api.delete(`/api/v1/admin/finance/sellers/${profileId}`);
}

export async function restoreAdminSeller(profileId: string): Promise<AdminSeller> {
  const response = await api.post<AdminSeller>(`/api/v1/admin/finance/sellers/${profileId}/restore`);
  return response.data;
}

export async function verifyAdminSeller(profileId: string, verified: boolean): Promise<AdminSeller> {
  const response = await api.post<AdminSeller>(`/api/v1/admin/finance/sellers/${profileId}/verify`, null, {
    params: { verified },
  });
  return response.data;
}

export async function updateAdminSellerPricing(
  profileId: string,
  payload: AdminSellerPricingPayload,
): Promise<AdminSeller> {
  const response = await api.put<AdminSeller>(`/api/v1/admin/finance/sellers/${profileId}/pricing`, payload);
  return response.data;
}

export async function getAdminUserStats(): Promise<AdminUserStats> {
  const response = await api.get<AdminUserStats>("/api/v1/admin/finance/users/stats");
  return response.data;
}

export async function listAdminUsers(query?: string, limit = 200): Promise<AdminUser[]> {
  const response = await api.get<AdminUser[]>("/api/v1/admin/finance/users", {
    params: { query, limit },
  });
  return response.data;
}

export async function removeAdminUser(userId: string): Promise<void> {
  await api.delete(`/api/v1/admin/finance/users/${userId}`);
}

export async function restoreAdminUser(userId: string): Promise<AdminUser> {
  const response = await api.post<AdminUser>(`/api/v1/admin/finance/users/${userId}/restore`);
  return response.data;
}

export async function downloadAuditCsv(limit = 1000): Promise<Blob> {
  const response = await api.get("/api/v1/admin/finance/audit-history/export", {
    params: { limit },
    responseType: "blob",
  });
  return response.data as Blob;
}
