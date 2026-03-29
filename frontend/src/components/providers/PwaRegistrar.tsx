"use client";

import { useEffect } from "react";

export function PwaRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    // Temporary safety mode: aggressively unregister old service workers so
    // production phones stop serving stale cached assets and outdated image logic.
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(
          registrations.map((registration) =>
            registration.unregister().catch(() => false)
          )
        )
      )
      .catch(() => undefined);
  }, []);

  return null;
}
