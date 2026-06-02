"use client";

import { useEffect } from "react";

const PING_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes

function ping() {
  fetch("/api/ping-backend", { method: "GET", cache: "no-store" }).catch(() => {});
}

// Ping le backend au chargement puis toutes les 4 minutes pour éviter le sommeil Render.
// Silencieux — aucun impact sur l'UI.
export function BackendKeepAlive() {
  useEffect(() => {
    ping();
    const id = setInterval(ping, PING_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return null;
}
