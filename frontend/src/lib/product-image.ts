import { resolveImageUrl } from "@/lib/image";

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
}): string {
  const fallback = productFallbackImage(options.categorySlug);
  const resolved = resolveImageUrl(options.raw);
  if (!resolved) {
    return fallback;
  }

  const host = hostFromUrl(resolved);
  if (host && blockedHosts.has(host)) {
    return fallback;
  }
  return resolved;
}
