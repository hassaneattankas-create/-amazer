export type ConversationRole = "customer" | "seller";

export type ConversationMessage = {
  id: string;
  body: string;
  created_at: string;
  is_mine: boolean;
  read: boolean;
};

export type ConversationSummary = {
  id: string;
  vendor_id: string;
  counterpart_name: string;
  role: ConversationRole;
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
};

export type ConversationDetail = ConversationSummary & {
  messages: ConversationMessage[];
};
