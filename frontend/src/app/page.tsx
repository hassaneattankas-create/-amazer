import { HomeClient } from "@/components/home/HomeClient";
import { filterPublicHomeContent, filterPublicProductSearchResult, filterPublicPromotions, filterPublicStorefronts } from "@/lib/public-catalog-filter";
import { fetchPublicApi } from "@/lib/seo";
import type { PromotionItem, VendorStorefront } from "@/types/catalog";
import type { HomeContent } from "@/types/content";
import type { ProductSearchResult } from "@/types/product";

/** Page régénérée au plus toutes les minutes : un établissement mis « À la une » par l'admin apparaît vite. */
const REVALIDATE_SECONDS = 60;
/** Application Android (export statique) : pas de serveur, le téléphone charge les rangées comme avant. */
const STATIC_EXPORT = process.env.NEXT_STATIC_EXPORT === "true";

/**
 * Accueil : les rangées (Bonnes affaires, Boutiques à la une, sections de l'admin) sont préparées par le serveur,
 * avec les mêmes requêtes et filtres que le téléphone : la page arrive déjà remplie, sans emplacement de chargement
 * qui disparaît (décalage mesuré par Google). Si l'API ne répond pas à temps, le téléphone les charge comme avant.
 */
export default async function HomePage() {
  if (STATIC_EXPORT) return <HomeClient />;
  const [products, promotions, shops, content] = await Promise.all([
    // Mêmes critères que la vue par défaut du téléphone (24 nouveautés en stock).
    fetchPublicApi<ProductSearchResult>("/api/v1/products/search?limit=24&offset=0&sort=newest&in_stock_only=true", REVALIDATE_SECONDS),
    fetchPublicApi<{ items: PromotionItem[] }>("/api/v1/promotions?limit=120", REVALIDATE_SECONDS),
    fetchPublicApi<{ items: VendorStorefront[] }>("/api/v1/storefronts?limit=24", REVALIDATE_SECONDS),
    fetchPublicApi<HomeContent>("/api/v1/home-content", REVALIDATE_SECONDS),
  ]);
  return (
    <HomeClient
      initial={{
        products: products ? filterPublicProductSearchResult(products) : null,
        promotions: promotions?.items ? filterPublicPromotions(promotions.items) : null,
        shops: shops?.items ? filterPublicStorefronts(shops.items) : null,
        content: content ? filterPublicHomeContent(content) : null,
      }}
    />
  );
}
