import { api } from "@/lib/api";
import { CreateFeedbackPayload, CustomerFeedback } from "@/types/feedback";

export async function listFeedback(limit = 80): Promise<CustomerFeedback[]> {
  const response = await api.get<CustomerFeedback[]>("/api/v1/feedback", {
    params: { limit },
  });
  return response.data;
}

export async function createFeedback(payload: CreateFeedbackPayload): Promise<CustomerFeedback> {
  const response = await api.post<CustomerFeedback>("/api/v1/feedback", payload);
  return response.data;
}
