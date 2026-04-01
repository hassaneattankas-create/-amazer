import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { getBackendOriginFromEnv } from "@/lib/backend-origin";

const BACKEND_ORIGIN = getBackendOriginFromEnv();

export const runtime = "nodejs";

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await context.params;
  if (!path.length || path[0] !== "admin") {
    return Response.json({ detail: "Forbidden admin proxy path" }, { status: 403 });
  }

  const url = new URL(request.url);
  const upstreamUrl = `${BACKEND_ORIGIN}/api/v1/${path.join("/")}${url.search}`;
  const cookieStore = await cookies();

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers.set("authorization", authorization);
  }
  const csrfHeader = request.headers.get("x-csrf-token");
  if (csrfHeader) {
    headers.set("x-csrf-token", csrfHeader);
  }

  const forwardedCookies: string[] = [];
  for (const name of ["access_token", "refresh_token", "csrf_token", "finance_pin_verified"]) {
    const value = cookieStore.get(name)?.value;
    if (value) {
      forwardedCookies.push(`${name}=${value}`);
    }
  }
  if (forwardedCookies.length) {
    headers.set("cookie", forwardedCookies.join("; "));
  }

  const body =
    request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
    redirect: "manual",
  });

  const responseHeaders = new Headers();
  const upstreamType = upstream.headers.get("content-type");
  if (upstreamType) {
    responseHeaders.set("content-type", upstreamType);
  }

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(request, context);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(request, context);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(request, context);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(request, context);
}
