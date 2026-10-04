import { Easing } from "remotion";

/**
 * Courbes AMAZER, identiques a frontend/src/lib/design-tokens.ts.
 * Une seule grammaire de mouvement entre le web et la video.
 */
export const EASE = {
  /** Entrees d'elements — easeOutQuint. */
  out: Easing.bezier(0.22, 1, 0.36, 1),
  /** Transitions de plan — easeInOutCubic. */
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  /** Rebond amorti ~8 % — UI, badges, CTA. */
  spring: Easing.bezier(0.34, 1.26, 0.64, 1),
  /** Sorties d'ecran, propulsions — backIn adouci. */
  exit: Easing.bezier(0.55, 0, 1, 0.45),
} as const;
