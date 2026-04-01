const DEFAULT_BACKEND_ORIGIN = "https://amazer-api.onrender.com";

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
