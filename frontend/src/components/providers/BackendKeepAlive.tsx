"use client";

import { useEffect } from "react";

// Ping le backend à chaque ouverture de page pour éviter le cold start Render.
// Silencieux — aucun impact sur l'UI.
export function BackendKeepAlive() {
  useEffect(() => {
    fetch("/api/ping-backend", { method: "GET", cache: "no-store" }).catch(() => {});
  }, []);

  return null;
}
