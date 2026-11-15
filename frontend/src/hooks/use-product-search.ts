"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { searchProducts } from "@/services/product-service";
import type { ProductSearchResult, SearchSort } from "@/types/product";

export type ProductSearchFilters = {
  categorySlug?: string;
  sort?: SearchSort;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
};

type ProductSearchParams = ProductSearchFilters & {
  query?: string;
  barcode?: string;
  /** Nombre de produits a charger (bouton « Voir plus » : on augmente la limite). */
  limit?: number;
  /** Resultat deja prepare par le serveur pour ces memes criteres (accueil) : affiche tout de suite. */
  initialData?: ProductSearchResult;
};

export function useProductSearch({
  query = "",
  barcode = "",
  limit = 36,
  categorySlug,
  sort,
  minPrice,
  maxPrice,
  inStockOnly = true,
  initialData,
}: ProductSearchParams) {
  const normalizedQuery = query.trim();
  const normalizedBarcode = barcode.trim();
  const hasTextFilter = normalizedQuery.length >= 2 || normalizedBarcode.length >= 3;
  // Sans texte recherche, la pertinence n'a pas de sens : on montre les nouveautes.
  const effectiveSort: SearchSort = sort ?? (hasTextFilter ? "relevance" : "newest");

  return useQuery({
    queryKey: [
      "products-search",
      normalizedQuery,
      normalizedBarcode,
      limit,
      categorySlug ?? "",
      effectiveSort,
      minPrice ?? 0,
      maxPrice ?? 0,
      inStockOnly,
    ],
    queryFn: () =>
      searchProducts({
        query: hasTextFilter ? normalizedQuery : undefined,
        barcode: hasTextFilter ? normalizedBarcode : undefined,
        categorySlug,
        sort: effectiveSort,
        minPrice,
        maxPrice,
        inStockOnly,
        limit,
      }),
    initialData,
    staleTime: hasTextFilter ? 60_000 : 120_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
