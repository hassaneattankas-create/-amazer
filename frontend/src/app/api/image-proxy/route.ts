import { NextRequest } from "next/server";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
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
    (first === 192 && second === 168)
  );
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    LOCAL_HOSTS.has(normalized) ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
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

  const upstream = await fetch(targetUrl, {
    headers: {
      Accept: "image/*,*/*;q=0.8",
      "User-Agent": "AMAZER Image Proxy",
    },
    redirect: "follow",
    next: { revalidate: 60 * 60 * 24 },
  });

  const finalUrl = upstream.url ? new URL(upstream.url) : targetUrl;
  if (isBlockedHostname(finalUrl.hostname)) {
    return jsonError("Blocked redirect host", 403);
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

  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=259200",
      "Content-Length": String(body.byteLength),
      "Content-Type": contentType,
    },
  });
}
