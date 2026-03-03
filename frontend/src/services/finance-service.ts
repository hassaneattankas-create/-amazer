import { api } from "@/lib/api";
import {
  AdminOrderTracking,
  DistrictFeeItem,
  FinanceSettings,
  FinanceSummary,
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
  await api.post("/api/v1/admin/finance/pin/verify", payload);
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
