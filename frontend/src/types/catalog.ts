export type VendorStorefront = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  is_verified: boolean;
  business_name: string | null;
  city: string | null;
  phone: string | null;
  address: string | null;
  product_count: number;
  promotion_count: number;
};

export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
};

export type PromotionItem = {
  product_id: string;
  product_name: string;
  brand: string;
  main_image_url: string | null;
  category_slug: string | null;
  vendor: {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
    is_verified: boolean;
  };
  original_amount: number;
  promo_amount: number;
  currency: string;
  promo_until: string | null;
  is_boosted: boolean;
};
