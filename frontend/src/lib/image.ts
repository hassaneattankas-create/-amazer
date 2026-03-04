const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || "";

function getApiOrigin(): string {
  if (!API_BASE_URL) {
    return "";
  }
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return "";
  }
}

function toHttpsIfPossible(url: URL): string {
  if (url.protocol === "http:") {
    url.protocol = "https:";
  }
  return url.toString();
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
    return origin ? `${origin}${value}` : null;
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      return toHttpsIfPossible(new URL(value));
    } catch {
      return null;
    }
  }

  try {
    return toHttpsIfPossible(new URL(`https://${value}`));
  } catch {
    return null;
  }
}
