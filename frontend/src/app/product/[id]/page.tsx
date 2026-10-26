import type { Metadata } from "next";

import { ProductDetailView } from "@/components/product/ProductDetailView";
import { formatXOF } from "@/lib/currency";
import { resolveImageUrl } from "@/lib/image";
import { SITE_URL, fetchPublicApi, jsonLd, shortText } from "@/lib/seo";
import type { ProductDetailData } from "@/types/product";

type Props = { params: Promise<{ id: string }> };

function bestPrice(data: ProductDetailData): number | null {
  const prices = data.offers.filter((o) => o.is_active).map((o) => o.amount);
  const fallback = data.product.best_offer?.amount;
  return prices.length ? Math.min(...prices) : fallback ?? null;
}

const loadProduct = (id: string) => fetchPublicApi<ProductDetailData>(`/api/v1/products/${encodeURIComponent(id)}`);

/** Titre, description et aperçu de partage (photo, prix) du produit : liens WhatsApp et Google lisibles. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const canonical = `/product/${encodeURIComponent(id)}`;
  const data = await loadProduct(id);
  if (!data) return { title: "Produit | AMAZER", alternates: { canonical } };
  const { product } = data;
  const price = bestPrice(data);
  const title = `${product.name}${price ? ` à ${formatXOF(price)}` : ""} | AMAZER`;
  const description =
    shortText(product.description) ||
    `${product.name}${price ? ` à ${formatXOF(price)}` : ""} sur AMAZER : paiement contrôlé et livraison au Niger.`;
  const image = resolveImageUrl(product.main_image_url ?? product.images?.[0]?.image_url);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website", siteName: "AMAZER", locale: "fr_NE", ...(image ? { images: [{ url: image, alt: product.name }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params;
  const data = await loadProduct(id);
  const price = data ? bestPrice(data) : null;
  const image = data ? resolveImageUrl(data.product.main_image_url) : null;
  // Données structurées Google (fiche produit avec prix en XOF).
  const structured = data
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: data.product.name,
        ...(data.product.brand ? { brand: { "@type": "Brand", name: data.product.brand } } : {}),
        ...(data.product.description ? { description: shortText(data.product.description, 500) } : {}),
        ...(image ? { image: [image] } : {}),
        url: `${SITE_URL}/product/${encodeURIComponent(id)}`,
        ...(price
          ? {
              offers: {
                "@type": "AggregateOffer",
                priceCurrency: "XOF",
                lowPrice: price,
                offerCount: Math.max(1, data.offers.filter((o) => o.is_active).length),
                availability: data.offers.some((o) => o.is_active && o.stock_quantity > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              },
            }
          : {}),
      }
    : null;
  return (
    <>
      {structured ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} /> : null}
      <ProductDetailView productId={id} />
    </>
  );
}
