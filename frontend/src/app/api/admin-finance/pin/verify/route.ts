import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getBackendOriginFromEnv } from "@/lib/backend-origin";

const BACKEND_ORIGIN = getBackendOriginFromEnv();

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  const payload = await request.text();
  const cookieStore = await cookies();

  const upstreamHeaders = new Headers({
    "Content-Type": request.headers.get("content-type") || "application/json",
  });

  const authorization = request.headers.get("authorization");
  if (authorization) {
    upstreamHeaders.set("authorization", authorization);
  }

  const csrfHeader = request.headers.get("x-csrf-token");
  if (csrfHeader) {
    upstreamHeaders.set("x-csrf-token", csrfHeader);
  }

  const forwardedCookies: string[] = [];
  for (const name of ["access_token", "refresh_token", "csrf_token"]) {
    const value = cookieStore.get(name)?.value;
    if (value) {
      forwardedCookies.push(`${name}=${value}`);
    }
  }
  if (forwardedCookies.length) {
    upstreamHeaders.set("cookie", forwardedCookies.join("; "));
  }

  const upstream = await fetch(`${BACKEND_ORIGIN}/api/v1/admin/finance/pin/verify`, {
    method: "POST",
    headers: upstreamHeaders,
    body: payload,
    redirect: "manual",
    cache: "no-store",
  });

  if (!upstream.ok) {
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
      },
    });
  }

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set({
    name: "finance_pin_verified",
    value: "1",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 60,
    path: "/",
  });
  return response;
}
