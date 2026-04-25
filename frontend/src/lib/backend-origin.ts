const DEFAULT_BACKEND_ORIGIN = "https://amazer-api.onrender.com";
/** Aligné sur le déploiement web (rewrites /backend-api). Repli si la variable n’a pas été injectée au build. */
const DEFAULT_MOBILE_SITE_ORIGIN = "https://amazer.store";

/**
 * Si défini (ex. https://mondomaine.ne), l’APK packagée utilise le proxy Next `/backend-api` de ce site.
 * Sinon, en build mobile, repli sur le site de prod pour garder le même comportement que le web.
 */
export function getMobileSiteOriginFromEnv(): string {
  const raw = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_MOBILE_SITE_URL?.trim() : "";
  if (raw) {
    return raw;
  }
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_MOBILE_APP === "true") {
    return DEFAULT_MOBILE_SITE_ORIGIN;
  }
  return "";
}

/**
 * Base des appels API pour build mobile packagé (export statique).
 */
export function getMobileBundledBackendApiBase(): string {
  const site = getMobileSiteOriginFromEnv();
  if (site) {
    return `${site.replace(/\/$/, "")}/backend-api`;
  }
  return getBackendOriginFromEnv();
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
