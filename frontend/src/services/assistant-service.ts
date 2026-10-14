import { api } from "@/lib/api";

export type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

/** Produit reel du catalogue propose par l'assistant. */
export type AssistantProduct = {
  id: string;
  name: string;
  price: number;
  shop: string;
  image_url: string | null;
};

export type AssistantResponse = {
  reply: string;
  mode: "ai" | "faq";
  products?: AssistantProduct[];
};

export async function sendAssistantMessage(
  messages: AssistantMessage[],
): Promise<AssistantResponse> {
  // Le serveur n'accepte que role + content : on retire tout champ d'affichage.
  const response = await api.post<AssistantResponse>("/api/v1/assistant/chat", {
    messages: messages.slice(-12).map(({ role, content }) => ({ role, content })),
  });
  return response.data;
}
