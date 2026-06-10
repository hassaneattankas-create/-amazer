import { api } from "@/lib/api";

export type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantResponse = {
  reply: string;
  mode: "ai" | "faq";
};

export async function sendAssistantMessage(
  messages: AssistantMessage[],
): Promise<AssistantResponse> {
  const response = await api.post<AssistantResponse>("/api/v1/assistant/chat", {
    messages: messages.slice(-12),
  });
  return response.data;
}
