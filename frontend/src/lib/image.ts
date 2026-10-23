import { getBackendOriginFromEnv, publicSiteOrigin } from "@/lib/backend-origin";
import { isMobileAppBuild } from "@/lib/mobile-app";

const IMAGE_PROXY_ROUTE = "/api/image-proxy";

function getApiOrigin(): string {
  return getBackendOriginFromEnv();
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

// CDN déjà listés dans next.config.mjs remotePatterns — Next.js les optimise directement, pas besoin du proxy
const NO_PROXY_HOSTS = new Set([
  "images.unsplash.com",
  "unsplash.com",
  "placehold.co",
  "images.pexels.com",
  "cdn.pixabay.com",
  // Stockage des images AMAZER (Backblaze B2, region eu-central-003).
  "f003.backblazeb2.com",
]);

function toHttpsIfPossible(url: URL): string {
  if (url.protocol === "http:" && !LOCAL_HOSTS.has(url.hostname)) {
    url.protocol = "https:";
  }
  return url.toString();
}

function shouldProxyImageUrl(value: string): boolean {
  if (isMobileAppBuild()) {
    return false;
  }
  try {
    const url = new URL(value);
    if (!/^https?:$/i.test(url.protocol)) {
      return false;
    }
    if (LOCAL_HOSTS.has(url.hostname)) {
      return false;
    }
    if (NO_PROXY_HOSTS.has(url.hostname)) {
      return false;
    }
    // Le backend est dans remotePatterns — Next.js l'optimise directement
    try {
      const backendOrigin = getApiOrigin();
      if (backendOrigin && url.origin === new URL(backendOrigin).origin) {
        return false;
      }
    } catch {
      // ignore si backend origin invalide
    }
    if (typeof window !== "undefined" && url.origin === window.location.origin) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function toImageProxyUrl(value: string): string {
  return `${IMAGE_PROXY_ROUTE}?url=${encodeURIComponent(value)}`;
}

function isLikelyRelativeMediaPath(value: string): boolean {
  if (!value || value.startsWith("/") || value.startsWith("//")) {
    return false;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return false;
  }
  // Ex: media/abc.webp, uploads/img.png
  return value.includes("/");
}

/** Largeurs des petites versions servies par /api/image-proxy (vignette, carte, grande photo). */
export type ImageWidth = 200 | 400 | 800;

/**
 * Petite version d'une image (WebP redimensionné, mis en cache un an) : chargement quasi immédiat
 * au lieu de la photo d'origine (souvent 300 Ko à 2 Mo). Dans l'application Android, l'adresse publique du site sert.
 */
export function sizedImageUrl(url: string | null, width?: ImageWidth): string | null {
  if (!url || !width) return url;
  if (url.startsWith(`${IMAGE_PROXY_ROUTE}?`)) {
    return `${url}&w=${width}`;
  }
  if (!/^https?:\/\//i.test(url)) return url;
  try {
    if (LOCAL_HOSTS.has(new URL(url).hostname)) return url;
  } catch {
    return url;
  }
  const origin = isMobileAppBuild() ? publicSiteOrigin().replace(/\/$/, "") : "";
  return `${origin}${IMAGE_PROXY_ROUTE}?url=${encodeURIComponent(url)}&w=${width}`;
}

export function resolveImageUrl(raw: string | null | undefined, width?: ImageWidth): string | null {
  return sizedImageUrl(resolveFullImageUrl(raw), width);
}

function resolveFullImageUrl(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const value = raw.trim();
  if (!value) {
    return null;
  }

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  // Backward compatibility: some records may already store a proxy URL.
  // Keep it as-is instead of rewriting it to the backend origin.
  if (value.startsWith(`${IMAGE_PROXY_ROUTE}?`)) {
    return value;
  }

  if (value.startsWith("/media/")) {
    const filename = value.split("/").filter(Boolean).pop();
    if (!filename) {
      return null;
    }
    const origin = getApiOrigin();
    if (!origin) {
      return null;
    }
    const absoluteUrl = `${origin}/api/v1/media/file/${encodeURIComponent(filename)}`;
    return shouldProxyImageUrl(absoluteUrl) ? toImageProxyUrl(absoluteUrl) : absoluteUrl;
  }

  if (value.startsWith("/")) {
    const origin = getApiOrigin();
    if (!origin) {
      return null;
    }
    const absoluteUrl = `${origin}${value}`;
    return shouldProxyImageUrl(absoluteUrl) ? toImageProxyUrl(absoluteUrl) : absoluteUrl;
  }

  if (isLikelyRelativeMediaPath(value)) {
    const origin = getApiOrigin();
    if (!origin) {
      return null;
    }
    const normalizedPath = value.startsWith("/") ? value : `/${value}`;
    const absoluteUrl = `${origin}${normalizedPath}`;
    return shouldProxyImageUrl(absoluteUrl) ? toImageProxyUrl(absoluteUrl) : absoluteUrl;
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const absoluteUrl = toHttpsIfPossible(new URL(value));
      return shouldProxyImageUrl(absoluteUrl) ? toImageProxyUrl(absoluteUrl) : absoluteUrl;
    } catch {
      return null;
    }
  }

  try {
    const absoluteUrl = toHttpsIfPossible(new URL(`https://${value}`));
    return shouldProxyImageUrl(absoluteUrl) ? toImageProxyUrl(absoluteUrl) : absoluteUrl;
  } catch {
    return null;
  }
}

export function normalizeImageInputForApi(raw: string | null | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }
  const value = raw.trim();
  if (!value) {
    return undefined;
  }

  // Preserve uploaded local media paths such as /media/filename.webp.
  if (value.startsWith("/media/")) {
    const filename = value.split("/").filter(Boolean).pop();
    return filename ? `/api/v1/media/file/${filename}` : undefined;
  }

  if (value.startsWith("/")) {
    return value;
  }

  // Backward compatibility: keep relative local paths consistent with backend format.
  if (isLikelyRelativeMediaPath(value)) {
    return `/${value}`;
  }

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      return new URL(value).toString();
    } catch {
      return undefined;
    }
  }

  try {
    return new URL(`https://${value}`).toString();
  } catch {
    return undefined;
  }
}
