import { filterPublicStorefronts } from "@/lib/public-catalog-filter";
import { fetchPublicApi } from "@/lib/seo";
import type { VendorStorefront } from "@/types/catalog";

/** Application Android (export statique) : pas de serveur, les pages chargent leurs données comme avant. */
export const STATIC_EXPORT = process.env.NEXT_STATIC_EXPORT === "true";

/** Listes publiques régénérées au plus toutes les minutes (un établissement mis « À la une » apparaît vite). */
export const PREFETCH_SECONDS = 60;

/**
 * Vitrines préparées par le serveur, avec les mêmes paramètres et filtres que `listStorefronts` côté téléphone :
 * la page arrive remplie (photos dans la page dès le départ). null si l'API n'a pas répondu à temps.
 */
export async function prefetchStorefronts(params: { activityType?: string; storefrontTier?: string } = {}): Promise<VendorStorefront[] | null> {
  if (STATIC_EXPORT) return null;
  const query = new URLSearchParams({ limit: "120" });
  if (params.activityType) query.set("activity_type", params.activityType);
  if (params.storefrontTier) query.set("storefront_tier", params.storefrontTier);
  const data = await fetchPublicApi<{ items: VendorStorefront[] }>(`/api/v1/storefronts?${query.toString()}`, PREFETCH_SECONDS);
  return data?.items ? filterPublicStorefronts(data.items) : null;
}
