import { api } from "@/lib/api";
import { filterPublicPromotions, filterPublicStorefronts } from "@/lib/public-catalog-filter";
import { CatalogCategory, PromotionItem, VendorStorefront } from "@/types/catalog";

type StorefrontFilters = {
  query?: string;
  activityType?: "shop" | "restaurant" | "hotel" | "enterprise";
  storefrontTier?: "basic" | "premium";
  limit?: number;
};

export async function listStorefronts(filters?: StorefrontFilters): Promise<VendorStorefront[]> {
  const response = await api.get<{ items: VendorStorefront[] }>("/api/v1/storefronts", {
    params: {
      limit: filters?.limit ?? 120,
      ...(filters?.query?.trim() ? { query: filters.query.trim() } : {}),
      ...(filters?.activityType ? { activity_type: filters.activityType } : {}),
      ...(filters?.storefrontTier ? { storefront_tier: filters.storefrontTier } : {}),
    },
  });
  return filterPublicStorefronts(response.data.items);
}

export async function listPromotions(query?: string): Promise<PromotionItem[]> {
  const response = await api.get<{ items: PromotionItem[] }>("/api/v1/promotions", {
    params: query?.trim() ? { query: query.trim(), limit: 120 } : { limit: 120 },
  });
  return filterPublicPromotions(response.data.items);
}

export async function listCatalogCategories(): Promise<CatalogCategory[]> {
  const response = await api.get<{ items: CatalogCategory[] }>("/api/v1/categories", {
    params: { limit: 200 },
  });
  return response.data.items;
}
