export type CustomerFeedback = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  message: string;
  rating: number;
  created_at: string;
};

export type CreateFeedbackPayload = {
  full_name: string;
  email?: string;
  message: string;
  rating: number;
};
