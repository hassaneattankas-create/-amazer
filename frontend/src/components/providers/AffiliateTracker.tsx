"use client";

import { useEffect } from "react";

import { captureAffiliateCode } from "@/lib/affiliate";
import { recordAffiliateClick } from "@/services/affiliate-service";

/** Retient le code ?ref= d'un lien affilie et compte la visite (une fois par session et par code). */
export function AffiliateTracker() {
  useEffect(() => {
    const code = captureAffiliateCode(window.location.search);
    if (!code) return;
    const key = `amazer_ref_click_${code}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // sans stockage de session, on compte quand meme une fois
    }
    void recordAffiliateClick(code).catch(() => undefined);
  }, []);
  return null;
}
