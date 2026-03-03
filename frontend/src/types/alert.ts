export type CreatePriceAlertPayload = {
  product_id: string;
  target_price: number;
};

export type PriceAlertResponse = {
  id: string;
  user_id: string;
  product_id: string;
  target_price: number;
  currency: string;
  is_active: boolean;
  created_at: string;
};
