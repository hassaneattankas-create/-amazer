import type { MetadataRoute } from "next";

import { SITE_URL, fetchPublicApi } from "@/lib/seo";
import type { CatalogCategory, VendorStorefront } from "@/types/catalog";
import type { ProductSearchResult } from "@/types/product";

// Généré à chaque déploiement : la carte du site suit le catalogue sans charger l'API à chaque visite.
export const dynamic = "force-static";

const STATIC_PAGES: Array<[string, number]> = [
  ["/", 1],
  ["/boutiques", 0.9],
  ["/promotions", 0.8],
  ["/stations", 0.8],
  ["/pharmacies", 0.8],
  ["/hotels", 0.7],
  ["/vendre", 0.7],
  ["/affiliation", 0.6],
  ["/revendre", 0.6],
  ["/comment-ca-marche", 0.6],
  ["/formations", 0.5],
  ["/avis", 0.4],
  ["/legal/terms", 0.2],
  ["/legal/privacy", 0.2],
];
const MAX_PRODUCTS = 2000;

async function allProducts(): Promise<string[]> {
  const ids: string[] = [];
  for (let offset = 0; offset < MAX_PRODUCTS; offset += 100) {
    const page = await fetchPublicApi<ProductSearchResult>(`/api/v1/products/search?limit=100&offset=${offset}`, 3600);
    const items = page?.items ?? [];
    ids.push(...items.map((p) => p.id));
    if (items.length < 100) break;
  }
  return ids;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [shops, categories, products] = await Promise.all([
    fetchPublicApi<{ items: VendorStorefront[] }>("/api/v1/storefronts?limit=500", 3600),
    fetchPublicApi<{ items: CatalogCategory[] }>("/api/v1/categories?limit=200", 3600),
    allProducts(),
  ]);
  return [
    ...STATIC_PAGES.map(([path, priority]) => ({ url: `${SITE_URL}${path}`, lastModified: now, priority })),
    ...(shops?.items ?? []).filter((s) => s.is_active).map((s) => ({ url: `${SITE_URL}/shop/${encodeURIComponent(s.id)}`, lastModified: now, priority: 0.7 })),
    ...(categories?.items ?? []).map((c) => ({ url: `${SITE_URL}/category/${encodeURIComponent(c.slug)}`, lastModified: now, priority: 0.6 })),
    ...products.map((id) => ({ url: `${SITE_URL}/product/${encodeURIComponent(id)}`, lastModified: now, priority: 0.5 })),
  ];
}
