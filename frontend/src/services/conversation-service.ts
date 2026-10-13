import { api } from "@/lib/api";
import type { ConversationDetail, ConversationSummary } from "@/types/conversation";

export async function listConversations(): Promise<ConversationSummary[]> {
  const response = await api.get<ConversationSummary[]>("/api/v1/conversations");
  return response.data;
}

export async function getConversation(conversationId: string): Promise<ConversationDetail> {
  const response = await api.get<ConversationDetail>(`/api/v1/conversations/${conversationId}`);
  return response.data;
}

export async function startConversation(vendorId: string, body: string): Promise<ConversationDetail> {
  const response = await api.post<ConversationDetail>("/api/v1/conversations", { vendor_id: vendorId, body });
  return response.data;
}

export async function sendMessage(conversationId: string, body: string): Promise<ConversationDetail> {
  const response = await api.post<ConversationDetail>(`/api/v1/conversations/${conversationId}/messages`, { body });
  return response.data;
}

export async function reportConversation(conversationId: string, reason: string): Promise<void> {
  await api.post(`/api/v1/conversations/${conversationId}/report`, { reason });
}
