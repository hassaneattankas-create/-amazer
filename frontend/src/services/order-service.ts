import { isAxiosError } from "axios";

import { api } from "@/lib/api";
import {
  CheckoutPayload,
  Order,
  PaymentConfirmPayload,
  PaymentConfirmResult,
  PaymentIntent,
  Receipt,
  ReceiptLink,
  ReceiptVerifyPayload,
  ReceiptVerifyResult,
} from "@/types/order";

export async function listMyOrders(): Promise<Order[]> {
  const response = await api.get<Order[]>("/api/v1/orders/me");
  return response.data;
}

export async function checkout(payload: CheckoutPayload): Promise<Order> {
  const response = await api.post<Order>("/api/v1/orders/checkout", payload);
  return response.data;
}

export async function getReceiptLink(orderId: string): Promise<ReceiptLink> {
  try {
    const response = await api.get<ReceiptLink>(`/api/v1/orders/${orderId}/receipt-link`);
    return response.data;
  } catch (error) {
    if (isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 422)) {
      const response = await api.get<ReceiptLink>(`/api/v1/restaurant/orders/${orderId}/receipt-link`);
      return response.data;
    }
    throw error;
  }
}

export async function getSecureReceipt(orderId: string, token?: string): Promise<Receipt> {
  const params = token ? { token } : undefined;
  try {
    const response = await api.get<Receipt>(`/api/v1/orders/receipt/${orderId}`, { params });
    return response.data;
  } catch (error) {
    if (isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 422)) {
      const response = await api.get<Receipt>(`/api/v1/restaurant/receipt/${orderId}`, { params });
      return response.data;
    }
    throw error;
  }
}

export async function verifyReceipt(payload: ReceiptVerifyPayload): Promise<ReceiptVerifyResult> {
  const response = await api.post<ReceiptVerifyResult>("/api/v1/orders/receipt/verify", payload);
  return response.data;
}

export async function getPaymentIntent(orderId: string): Promise<PaymentIntent> {
  try {
    const response = await api.get<PaymentIntent>(`/api/v1/orders/${orderId}/payment-intent`);
    return response.data;
  } catch (error) {
    if (isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 422)) {
      const response = await api.get<PaymentIntent>(`/api/v1/restaurant/orders/${orderId}/payment-intent`);
      return response.data;
    }
    throw error;
  }
}

export async function confirmPayment(orderId: string, payload: PaymentConfirmPayload): Promise<PaymentConfirmResult> {
  try {
    const response = await api.post<PaymentConfirmResult>(`/api/v1/orders/${orderId}/payment/confirm`, payload);
    return response.data;
  } catch (error) {
    if (isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 422)) {
      const response = await api.post<PaymentConfirmResult>(
        `/api/v1/restaurant/orders/${orderId}/payment/confirm`,
        payload
      );
      return response.data;
    }
    throw error;
  }
}

export async function startAmanaPayment(orderId: string): Promise<PaymentConfirmResult> {
  const response = await api.post<PaymentConfirmResult>(`/api/v1/orders/${orderId}/payment/start`);
  return response.data;
}

export async function confirmOrderReception(orderId: string): Promise<Order> {
  const response = await api.post<Order>(`/api/v1/orders/${orderId}/confirm-reception`);
  return response.data;
}
