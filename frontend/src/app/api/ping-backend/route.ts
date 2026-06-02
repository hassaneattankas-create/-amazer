import { NextResponse } from "next/server";

export const dynamic =
  process.env.NEXT_STATIC_EXPORT === "true" ? "force-static" : "force-dynamic";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_ORIGIN || "https://amazer-api.onrender.com";

export async function GET(): Promise<NextResponse> {
  const start = Date.now();
  try {
    const res = await fetch(`${BACKEND_URL}/health`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const elapsed = Date.now() - start;
    if (!res.ok) {
      return NextResponse.json({ ok: false, status: res.status, ms: elapsed }, { status: 502 });
    }
    return NextResponse.json({ ok: true, status: res.status, ms: elapsed });
  } catch {
    const elapsed = Date.now() - start;
    return NextResponse.json({ ok: false, error: "unreachable", ms: elapsed }, { status: 503 });
  }
}
