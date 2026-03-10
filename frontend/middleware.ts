import type { NextRequest } from "next/server";

import { proxy, config } from "./src/proxy";

export function middleware(request: NextRequest) {
  return proxy(request);
}

export { config };
