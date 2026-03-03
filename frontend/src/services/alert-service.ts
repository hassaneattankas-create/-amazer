import { api } from "@/lib/api";
import { CreatePriceAlertPayload, PriceAlertResponse } from "@/types/alert";

export async function createPriceAlert(
  payload: CreatePriceAlertPayload
): Promise<PriceAlertResponse> {
  const response = await api.post<PriceAlertResponse>("/api/v1/alerts", payload);
  return response.data;
}

export async function listActiveAlerts(): Promise<PriceAlertResponse[]> {
  const response = await api.get<PriceAlertResponse[]>("/api/v1/alerts");
  return response.data;
}
