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
  minPrice?: number;
  maxPrice?: number;
  /** Par defaut l'API ne renvoie que les produits en stock. */
  inStockOnly?: boolean;
};

export async function searchProducts({
  query,
  barcode,
  categorySlug,
  limit = 20,
  offset = 0,
  sort = "relevance",
  minPrice,
  maxPrice,
  inStockOnly,
}: SearchProductsParams): Promise<ProductSearchResult> {
  const params: Record<string, string | number | boolean> = { limit, offset, sort };
  if (typeof minPrice === "number" && minPrice > 0) {
    params.min_price = minPrice;
  }
  if (typeof maxPrice === "number" && maxPrice > 0) {
    params.max_price = maxPrice;
  }
  if (typeof inStockOnly === "boolean") {
    params.in_stock_only = inStockOnly;
  }
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
