import { resolveImageUrl, type ImageWidth } from "@/lib/image";

const blockedHosts = new Set(["picsum.photos", "fastly.picsum.photos"]);

const categoryFallbackMap: Record<string, string> = {
  alimentation: "/images/placeholders/alimentation.svg",
  hygiene: "/images/placeholders/alimentation.svg",
  maison: "/images/placeholders/maison.svg",
  accessoires: "/images/placeholders/accessoires.svg",
  electronique: "/images/placeholders/technologie.svg",
  technologie: "/images/placeholders/technologie.svg",
  restaurant: "/images/placeholders/restaurant.svg",
};

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function productFallbackImage(categorySlug?: string | null): string {
  if (!categorySlug) {
    return "/images/placeholders/default.svg";
  }
  return categoryFallbackMap[categorySlug.toLowerCase()] || "/images/placeholders/default.svg";
}

export function resolveProductImageUrl(options: {
  raw: string | null | undefined;
  categorySlug?: string | null;
  /** Petite version (200 / 400 / 800 px) : bien plus rapide à charger. */
  width?: ImageWidth;
}): string {
  const fallback = productFallbackImage(options.categorySlug);
  const resolved = resolveImageUrl(options.raw, options.width);
  if (!resolved) {
    return fallback;
  }

  const host = hostFromUrl(resolved);
  if (host && blockedHosts.has(host)) {
    return fallback;
  }
  return resolved;
}
