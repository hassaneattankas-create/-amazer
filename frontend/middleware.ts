import type { NextRequest } from "next/server";

import { proxy } from "./src/proxy";

export function middleware(request: NextRequest) {
  return proxy(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|logo-amazer.*|images/).*)",
  ],
};
