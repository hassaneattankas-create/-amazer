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

  const forwardedCookies = new Map<string, string>();
  const appendCookieHeader = (value: string | null) => {
    if (!value?.trim()) {
      return;
    }
    for (const rawCookie of value.split(";")) {
      const trimmed = rawCookie.trim();
      if (!trimmed) {
        continue;
      }
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }
      const name = trimmed.slice(0, separatorIndex).trim();
      const cookieValue = trimmed.slice(separatorIndex + 1).trim();
      if (name) {
        forwardedCookies.set(name, cookieValue);
      }
    }
  };

  // Priorité à l’en-tête Cookie brut (WebView / APK) : contient souvent les cookies HttpOnly
  // (finance_pin_verified, access_token) que le client envoie à Vercel. Ne pas se fier uniquement
  // à cookies() côté serveur, sinon les validations admin (POST) échouent sans message clair.
  appendCookieHeader(request.headers.get("cookie"));
  for (const name of ["access_token", "refresh_token", "csrf_token", "finance_pin_verified"]) {
    const value = cookieStore.get(name)?.value;
    if (value) {
      forwardedCookies.set(name, value);
    }
  }
  // Filet de sécurité mobile: si la WebView refuse de rejouer le cookie cross-site de validation admin,
  // le client envoie ce drapeau et on reconstruit le cookie attendu par le backend.
  if (request.headers.get("x-finance-pin-verified") === "1") {
    forwardedCookies.set("finance_pin_verified", "1");
  }
  if (forwardedCookies.size) {
    headers.set(
      "cookie",
      Array.from(forwardedCookies.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join("; ")
    );
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
