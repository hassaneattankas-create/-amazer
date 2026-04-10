const DEFAULT_BACKEND_ORIGIN = "https://amazer-api.onrender.com";

/** Site Next.js (Vercel) : même origine que le web pour l’APK packagée (évite cookies/CORS cassés). */
export const DEFAULT_MOBILE_SITE_ORIGIN = "https://amazerniger.vercel.app";

/**
 * Origine du site utilisée par les builds mobile packagés pour /backend-api et /api/* (proxy Next).
 */
export function getMobileSiteOriginFromEnv(): string {
  const v = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_MOBILE_SITE_URL?.trim() : "";
  return v || DEFAULT_MOBILE_SITE_ORIGIN;
}

/**
 * Base API pour APK statique : passe par le proxy du site (comme le navigateur), pas par Render direct.
 */
export function getMobileBundledBackendApiBase(): string {
  return `${getMobileSiteOriginFromEnv().replace(/\/$/, "")}/backend-api`;
}

/**
 * Resolves the API origin used by Next.js rewrites, server-side proxies, and image URLs.
 * Prefer NEXT_PUBLIC_BACKEND_ORIGIN; otherwise derive from NEXT_PUBLIC_API_URL (Vercel often sets only this).
 */
export function getBackendOriginFromEnv(): string {
  const explicit = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim() : "";
  const apiUrl = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_URL?.trim() : "";
  const raw = explicit || apiUrl || "";
  if (!raw) {
    return DEFAULT_BACKEND_ORIGIN;
  }
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withProtocol);
    return u.origin.replace(/\/$/, "");
  } catch {
    return DEFAULT_BACKEND_ORIGIN;
  }
}
