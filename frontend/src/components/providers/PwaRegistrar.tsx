"use client";

import { useEffect } from "react";

import { isMobileAppBuild } from "@/lib/mobile-app";

/**
 * Service worker minimal (public/sw.js) : rend le site installable sur Android et ordinateur.
 * Il ne garde rien en mémoire (pas de vieille version) et nettoie les anciens caches.
 * Pas dans l'application Android (Capacitor), qui est déjà installée.
 */
export function PwaRegistrar() {
  useEffect(() => {
    if (isMobileAppBuild() || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
  }, []);

  return null;
}
