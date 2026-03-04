import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATHS = ["/seller", "/admin"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin") || pathname.startsWith("/seller")) {
    const forwardedFor = request.headers.get("x-forwarded-for");
    const requestIp = forwardedFor ? forwardedFor.split(",")[0]?.trim() : "unknown";
    console.info(`[SECURITY] protected_page_access path=${pathname} ip=${requestIp || "unknown"}`);
  }

  const requiresAuth = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
  if (!requiresAuth) {
    return NextResponse.next();
  }

  const accessToken =
    request.cookies.get("access_token")?.value || request.cookies.get("amazer_access_token")?.value;
  if (accessToken) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/seller/:path*", "/admin/:path*"],
};
