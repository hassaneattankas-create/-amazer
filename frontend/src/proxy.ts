import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATHS = ["/seller", "/admin", "/dashboard", "/profile"];
const PRIMARY_HOSTNAME = "amazer.store";
const WWW_HOSTNAME = `www.${PRIMARY_HOSTNAME}`;

/** APK Capacitor (https://localhost) appelle le site Vercel en cross-origin : CORS requis. */
const CORS_PATH_PREFIXES = ["/backend-api", "/api/admin-proxy", "/api/admin-finance", "/api/image-proxy"];

function isCapacitorApiOrigin(origin: string | null): boolean {
  if (!origin) {
    return false;
  }
  if (
    origin === "https://localhost" ||
    origin === "http://localhost" ||
    origin === "https://127.0.0.1" ||
    origin === "http://127.0.0.1" ||
    origin === "capacitor://localhost"
  ) {
    return true;
  }
  if (origin.startsWith("http://localhost:") || origin.startsWith("https://localhost:")) {
    return true;
  }
  if (origin.startsWith("http://127.0.0.1:") || origin.startsWith("https://127.0.0.1:")) {
    return true;
  }
  return false;
}

function pathNeedsCors(pathname: string): boolean {
  return CORS_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

function attachCorsHeaders(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get("origin");
  if (origin && isCapacitorApiOrigin(origin) && pathNeedsCors(request.nextUrl.pathname)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Vary", "Origin");
  }
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.nextUrl.hostname.toLowerCase();
  const origin = request.headers.get("origin");

  if (hostname === WWW_HOSTNAME) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.hostname = PRIMARY_HOSTNAME;
    return NextResponse.redirect(redirectUrl, 308);
  }

  if (pathNeedsCors(pathname) && origin && isCapacitorApiOrigin(origin)) {
    if (request.method === "OPTIONS") {
      const preflight = new NextResponse(null, { status: 204 });
      preflight.headers.set("Access-Control-Allow-Origin", origin);
      preflight.headers.set("Access-Control-Allow-Credentials", "true");
      preflight.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      preflight.headers.set(
        "Access-Control-Allow-Headers",
        request.headers.get("access-control-request-headers") ||
          "Authorization, Content-Type, X-CSRF-Token, Cookie"
      );
      preflight.headers.set("Access-Control-Max-Age", "86400");
      preflight.headers.set("Vary", "Origin");
      return preflight;
    }
  }

  const accessToken =
    request.cookies.get("access_token")?.value || request.cookies.get("amazer_access_token")?.value;

  const requiresAuth = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
  if (!requiresAuth) {
    return attachCorsHeaders(request, NextResponse.next());
  }

  if (accessToken) {
    return attachCorsHeaders(request, NextResponse.next());
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|logo-amazer.*|images/).*)",
  ],
};
