export type SellerProfile = {
  id: string;
  user_id: string;
  vendor_id: string;
  business_name: string;
  phone: string | null;
  city: string;
  address: string | null;
  is_verified: boolean;
  created_at: string;
};

export type SellerProfilePayload = {
  business_name: string;
  phone?: string;
  city: string;
  address?: string;
};

export type SellerProductPayload = {
  name: string;
  brand: string;
  description?: string;
  main_image_url?: string;
  category_id?: string;
  amount: number;
  currency: string;
  stock_quantity: number;
};

export type SellerInventoryItem = {
  price_id: string;
  product_id: string;
  product_name: string;
  brand: string;
  amount: number;
  currency: string;
  stock_quantity: number;
  is_active: boolean;
  is_boosted: boolean;
  promo_price: number | null;
  promo_until: string | null;
  boost_until: string | null;
};
