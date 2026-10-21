"use client";

import { useEffect, useState } from "react";

/** Heure courante, rafraîchie régulièrement (retards, « il y a X min ») sans lire l'horloge pendant le rendu. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
