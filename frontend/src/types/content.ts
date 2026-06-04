export type HomeContentProduct = {
  id: string;
  name: string;
  brand: string;
  main_image_url: string | null;
  amount: number;
  currency: string;
};

export type HomeContentRestaurant = {
  id: string;
  name: string;
  slug: string;
};

export type HomeContentSection = {
  id: string;
  title: string;
  slug: string;
  section_type: "products" | "restaurants" | "mixed";
  products: HomeContentProduct[];
  restaurants: HomeContentRestaurant[];
};

export type HomeContent = {
  top_banner_url: string | null;
  sections: HomeContentSection[];
};

export type SectionItemInput = {
  target_type: "product" | "restaurant";
  product_id?: string;
  vendor_id?: string;
  sort_order: number;
};

export type DynamicSection = {
  id: string;
  title: string;
  slug: string;
  section_type: "products" | "restaurants" | "mixed";
  is_active: boolean;
  sort_order: number;
  created_at: string;
  items: Array<{
    id: string;
    target_type: "product" | "restaurant";
    product_id: string | null;
    vendor_id: string | null;
    sort_order: number;
  }>;
};

export type AdClickStats = {
  total_clicks: number;
  clicks_last_7_days: number;
  by_product: Array<{
    product_id: string;
    clicks: number;
  }>;
};

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
};
