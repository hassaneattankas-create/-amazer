const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || "";
const BACKEND_ORIGIN = (
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim() || "https://amazer-api.onrender.com"
).replace(/\/$/, "");
const IMAGE_PROXY_ROUTE = "/api/image-proxy";

function getApiOrigin(): string {
  if (BACKEND_ORIGIN) {
    return BACKEND_ORIGIN;
  }
  if (!API_BASE_URL) {
    return "";
  }
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return "";
  }
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

function toHttpsIfPossible(url: URL): string {
  if (url.protocol === "http:" && !LOCAL_HOSTS.has(url.hostname)) {
    url.protocol = "https:";
  }
  return url.toString();
}

function shouldProxyImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (!/^https?:$/i.test(url.protocol)) {
      return false;
    }
    if (LOCAL_HOSTS.has(url.hostname)) {
      return false;
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

export function resolveImageUrl(raw: string | null | undefined): string | null {
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

  if (value.startsWith("/")) {
    const origin = getApiOrigin();
    if (!origin) {
      return null;
    }
    const absoluteUrl = `${origin}${value}`;
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
