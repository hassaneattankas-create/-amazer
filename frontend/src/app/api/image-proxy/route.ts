import { NextRequest } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
// Petites versions demandées par le site (vignettes, grandes photos) : rien d'autre, pour un cache efficace.
const ALLOWED_WIDTHS = new Set([200, 400, 800]);
// Les fichiers d'images AMAZER ne sont jamais remplacés (nom unique) : cache d'un an.
const LONG_CACHE = "public, max-age=31536000, s-maxage=31536000, immutable";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function isPrivateIpv4(hostname: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return false;
  }

  const octets = hostname.split(".").map((part) => Number(part));
  if (octets.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return true;
  }

  const [first, second] = octets;
  return (
    first === 10 ||
    first === 127 ||
    first === 0 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    // Reseau partage des operateurs (CGNAT) et plages reservees.
    (first === 100 && second >= 64 && second <= 127) ||
    first >= 224
  );
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    LOCAL_HOSTS.has(normalized) ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    normalized.endsWith(".localhost") ||
    // Adresse IPv6 ecrite en clair ([::1], [fe80::…], [::ffff:127.0.0.1]…) : jamais une image publique.
    normalized.startsWith("[") ||
    normalized === "metadata.google.internal" ||
    isPrivateIpv4(normalized)
  );
}

function jsonError(message: string, status: number): Response {
  return Response.json({ detail: message }, { status });
}

export async function GET(request: NextRequest): Promise<Response> {
  const rawUrl = request.nextUrl.searchParams.get("url")?.trim();
  if (!rawUrl) {
    return jsonError("Missing image url", 400);
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return jsonError("Invalid image url", 400);
  }

  if (!["http:", "https:"].includes(targetUrl.protocol)) {
    return jsonError("Unsupported protocol", 400);
  }

  if (isBlockedHostname(targetUrl.hostname)) {
    return jsonError("Blocked host", 403);
  }

  // Redirections suivies une par une : chaque adresse est verifiee AVANT d'etre contactee.
  let upstream: Response | null = null;
  let current = targetUrl;
  for (let hop = 0; hop < 4; hop += 1) {
    let response: Response;
    try {
      response = await fetch(current, {
        headers: {
          Accept: "image/*,*/*;q=0.8",
          "User-Agent": "AMAZER Image Proxy",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
        next: { revalidate: 60 * 60 * 24 },
      });
    } catch {
      return jsonError("Upstream image unavailable", 404);
    }
    const location = response.status >= 300 && response.status < 400 ? response.headers.get("location") : null;
    if (!location) {
      upstream = response;
      break;
    }
    let next: URL;
    try {
      next = new URL(location, current);
    } catch {
      return jsonError("Invalid redirect", 400);
    }
    if (!["http:", "https:"].includes(next.protocol) || isBlockedHostname(next.hostname)) {
      return jsonError("Blocked redirect host", 403);
    }
    current = next;
  }
  if (!upstream) {
    return jsonError("Too many redirects", 400);
  }

  if (!upstream.ok) {
    return jsonError("Upstream image unavailable", 404);
  }

  const contentType = upstream.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    return jsonError("Upstream resource is not an image", 415);
  }

  const contentLength = Number(upstream.headers.get("content-length") || "0");
  if (contentLength > MAX_IMAGE_BYTES) {
    return jsonError("Image too large", 413);
  }

  const body = await upstream.arrayBuffer();
  if (body.byteLength > MAX_IMAGE_BYTES) {
    return jsonError("Image too large", 413);
  }

  const width = Number(request.nextUrl.searchParams.get("w") || 0);
  if (ALLOWED_WIDTHS.has(width) && !contentType.toLowerCase().includes("svg")) {
    try {
      // Version légère : redimensionnée, orientée correctement, en WebP (10 à 30 fois plus petite).
      const small = await sharp(Buffer.from(body), { failOn: "none", animated: false })
        .rotate()
        .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 72 })
        .toBuffer();
      return new Response(new Uint8Array(small), {
        headers: { "Cache-Control": LONG_CACHE, "Content-Length": String(small.byteLength), "Content-Type": "image/webp" },
      });
    } catch {
      // Image illisible pour la réduction : on renvoie l'originale.
    }
  }

  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=604800, s-maxage=31536000, stale-while-revalidate=259200",
      "Content-Length": String(body.byteLength),
      "Content-Type": contentType,
    },
  });
}
