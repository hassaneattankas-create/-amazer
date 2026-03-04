export type SearchSort = "relevance" | "price_asc" | "price_desc" | "newest";

export type Category = {
  id: string;
  name: string;
  slug: string;
};

export type Vendor = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  is_verified: boolean;
};

export type RankingBreakdown = {
  price_competitiveness: number;
  stock_signal: number;
  text_relevance: number;
  vendor_signal: number;
  score_total: number;
};

export type Offer = {
  price_id: string;
  vendor: Vendor;
  currency: string;
  amount: number;
  shipping_cost?: number;
  stock_quantity: number;
  is_active: boolean;
  ranking: RankingBreakdown;
};

export type ProductSearchItem = {
  id: string;
  name: string;
  brand: string;
  description: string | null;
  main_image_url: string | null;
  is_sponsored: boolean;
  is_boosted: boolean;
  ad_banner_url: string | null;
  specs: Record<string, unknown>;
  category: Category | null;
  created_at: string;
  images: Array<{
    id: string;
    image_url: string;
    sort_order: number;
  }>;
  best_offer: Offer;
};

export type ProductSearchMeta = {
  limit: number;
  offset: number;
  returned: number;
};

export type ProductSearchResult = {
  items: ProductSearchItem[];
  meta: ProductSearchMeta;
};

export type PriceHistoryPoint = {
  changed_at: string;
  amount: number;
};

export type ProductDetailData = {
  product: ProductSearchItem;
  offers: Offer[];
  price_history: PriceHistoryPoint[];
};
