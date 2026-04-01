import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATHS = ["/seller", "/admin", "/dashboard", "/profile"];
const APP_MODE_COOKIE_KEY = "amazer_app_mode";

function isSellerSpace(pathname: string): boolean {
  return (
    pathname === "/seller" ||
    pathname.startsWith("/seller/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}

function isFrameworkOrStaticPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/backend-api/") ||
    pathname === "/backend-api" ||
    pathname.startsWith("/media/") ||
    pathname === "/media" ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/logo-amazer")
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const accessToken =
    request.cookies.get("access_token")?.value || request.cookies.get("amazer_access_token")?.value;
  const appMode = request.cookies.get(APP_MODE_COOKIE_KEY)?.value;
  const sellerModeActive = appMode === "seller" && Boolean(accessToken);

  if (sellerModeActive && !isSellerSpace(pathname) && !isFrameworkOrStaticPath(pathname)) {
    return NextResponse.redirect(new URL("/seller", request.url));
  }

  const requiresAuth = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
  if (!requiresAuth) {
    return NextResponse.next();
  }

  if (accessToken) {
    return NextResponse.next();
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
