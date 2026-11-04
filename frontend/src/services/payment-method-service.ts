import { adminProxyRequest } from "@/lib/admin-proxy-client";
import { api } from "@/lib/api";
import type { AdminPaymentMethod, PaymentMethod, PaymentMethodInput } from "@/types/payment-method";

const ADMIN_URL = "/admin/finance/payment-methods";

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  return (await api.get<PaymentMethod[]>("/api/v1/payment-methods")).data;
}

export function listAdminPaymentMethods(): Promise<AdminPaymentMethod[]> {
  return adminProxyRequest<AdminPaymentMethod[]>({ url: ADMIN_URL, method: "GET" });
}

export function createPaymentMethod(payload: PaymentMethodInput): Promise<AdminPaymentMethod> {
  return adminProxyRequest<AdminPaymentMethod>({ url: ADMIN_URL, method: "POST", data: payload });
}

export function updatePaymentMethod(code: string, payload: PaymentMethodInput): Promise<AdminPaymentMethod> {
  return adminProxyRequest<AdminPaymentMethod>({ url: `${ADMIN_URL}/${encodeURIComponent(code)}`, method: "PUT", data: payload });
}

export function deletePaymentMethod(code: string): Promise<void> {
  return adminProxyRequest<void>({ url: `${ADMIN_URL}/${encodeURIComponent(code)}`, method: "DELETE" });
}
