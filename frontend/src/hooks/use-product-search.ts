"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { searchProducts } from "@/services/product-service";

type ProductSearchParams = {
  query?: string;
  barcode?: string;
  /** Nombre de produits a charger (bouton « Voir plus » : on augmente la limite). */
  limit?: number;
};

export function useProductSearch({ query = "", barcode = "", limit = 36 }: ProductSearchParams) {
  const normalizedQuery = query.trim();
  const normalizedBarcode = barcode.trim();
  const hasActiveFilter = normalizedQuery.length >= 2 || normalizedBarcode.length >= 3;

  return useQuery({
    queryKey: ["products-search", normalizedQuery, normalizedBarcode, limit],
    queryFn: () =>
      hasActiveFilter
        ? searchProducts({ query: normalizedQuery, barcode: normalizedBarcode, limit })
        : searchProducts({ sort: "newest", limit }),
    enabled: true,
    staleTime: hasActiveFilter ? 60_000 : 120_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
