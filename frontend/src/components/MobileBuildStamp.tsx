"use client";

import { isMobileAppBuild } from "@/lib/mobile-app";

/**
 * Affiche l’empreinte injectée au build mobile (voir scripts/build-mobile.mjs).
 * Permet de vérifier que l’APK correspond bien au dépôt / machine ayant lancé le build.
 */
export function MobileBuildStamp() {
  if (!isMobileAppBuild()) {
    return null;
  }
  const stamp = process.env.NEXT_PUBLIC_BUILD_STAMP?.trim();
  if (!stamp) {
    return null;
  }
  return (
    <p className="mt-8 text-center text-[10px] leading-tight text-slate-400" data-testid="mobile-build-stamp">
      Build: {stamp}
    </p>
  );
}
