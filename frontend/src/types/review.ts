export type Review = {
  id: string;
  product_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string;
  photo_url: string | null;
  created_at: string;
};

export type CreateReviewPayload = {
  rating: number;
  comment: string;
  photo_url?: string;
};
