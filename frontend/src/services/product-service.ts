import { api } from "@/lib/api";
import { filterPublicProductSearchResult } from "@/lib/public-catalog-filter";
import { ProductDetailData, ProductSearchResult, SearchSort } from "@/types/product";

type SearchProductsParams = {
  query?: string;
  barcode?: string;
  categorySlug?: string;
  limit?: number;
  offset?: number;
  sort?: SearchSort;
};

export async function searchProducts({
  query,
  barcode,
  categorySlug,
  limit = 20,
  offset = 0,
  sort = "relevance",
}: SearchProductsParams): Promise<ProductSearchResult> {
  const params: Record<string, string | number> = { limit, offset, sort };
  if (query && query.trim().length > 0) {
    params.query = query.trim();
  }
  if (barcode && barcode.trim().length > 0) {
    params.barcode = barcode.trim();
  }
  if (categorySlug && categorySlug.trim().length > 0) {
    params.category_slug = categorySlug.trim();
  }

  const response = await api.get<ProductSearchResult>("/api/v1/products/search", {
    params,
    timeout: 8000,
  });
  return filterPublicProductSearchResult(response.data);
}

export async function getProductDetailById(productId: string): Promise<ProductDetailData> {
  const response = await api.get<ProductDetailData>(`/api/v1/products/${productId}`);
  return response.data;
}

export async function getProductRecommendations(productId: string, limit = 4): Promise<ProductSearchResult> {
  const response = await api.get<ProductSearchResult>(`/api/v1/products/${productId}/recommendations`, {
    params: { limit },
  });
  return filterPublicProductSearchResult(response.data);
}
