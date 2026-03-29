"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { searchProducts } from "@/services/product-service";

type ProductSearchParams = {
  query?: string;
  barcode?: string;
};

export function useProductSearch({ query = "", barcode = "" }: ProductSearchParams) {
  const normalizedQuery = query.trim();
  const normalizedBarcode = barcode.trim();
  const hasActiveFilter = normalizedQuery.length >= 2 || normalizedBarcode.length >= 3;

  return useQuery({
    queryKey: ["products-search", normalizedQuery, normalizedBarcode],
    queryFn: () =>
      hasActiveFilter
        ? searchProducts({ query: normalizedQuery, barcode: normalizedBarcode, limit: 20 })
        : searchProducts({ sort: "newest", limit: 24 }),
    enabled: true,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
    retry: 1,
  });
}
