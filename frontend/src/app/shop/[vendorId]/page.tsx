import type { Metadata } from "next";

import { ShopView } from "@/components/storefront/ShopView";
import { resolveImageUrl } from "@/lib/image";
import { SITE_URL, fetchPublicApi, jsonLd, shortText } from "@/lib/seo";
import type { SellerStorefront } from "@/types/seller";

type Props = { params: Promise<{ vendorId: string }> };

const loadShop = (vendorId: string) => fetchPublicApi<SellerStorefront>(`/api/v1/seller/storefront/${encodeURIComponent(vendorId)}`);

/** Titre, description et aperçu de partage de la boutique (logo ou couverture). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { vendorId } = await params;
  const canonical = `/shop/${encodeURIComponent(vendorId)}`;
  const shop = await loadShop(vendorId);
  if (!shop) return { title: "Boutique | AMAZER", alternates: { canonical } };
  const title = `${shop.business_name}${shop.city ? ` · ${shop.city}` : ""} | AMAZER`;
  const description =
    shortText(shop.description) || `${shop.business_name} sur AMAZER : commandez en ligne, paiement contrôlé et livraison au Niger.`;
  const image = resolveImageUrl(shop.cover_image_url || shop.logo_url);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website", siteName: "AMAZER", locale: "fr_NE", ...(image ? { images: [{ url: image, alt: shop.business_name }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function VendorShopPage({ params }: Props) {
  const { vendorId } = await params;
  const shop = await loadShop(vendorId);
  const logo = shop ? resolveImageUrl(shop.logo_url || shop.cover_image_url) : null;
  // Données structurées Google : commerce local avec adresse et téléphone publics.
  const structured = shop
    ? {
        "@context": "https://schema.org",
        "@type": "Store",
        name: shop.business_name,
        url: `${SITE_URL}/shop/${encodeURIComponent(vendorId)}`,
        ...(shop.description ? { description: shortText(shop.description, 500) } : {}),
        ...(logo ? { image: logo } : {}),
        ...(shop.phone ? { telephone: shop.phone } : {}),
        ...(shop.opening_hours ? { openingHours: shop.opening_hours } : {}),
        address: { "@type": "PostalAddress", addressCountry: "NE", ...(shop.city ? { addressLocality: shop.city } : {}), ...(shop.address ? { streetAddress: shop.address } : {}) },
      }
    : null;
  return (
    <>
      {structured ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} /> : null}
      <ShopView vendorId={vendorId} />
    </>
  );
}
