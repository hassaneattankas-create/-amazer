import { clearAdminFinanceVerified } from "@/lib/api";

/** Événement écouté par la mise en page admin pour réafficher la saisie du PIN. */
export const ADMIN_PIN_EVENT = "amazer:admin-pin-required";

/** Oublie le PIN et redemande la vérification (bouton « Verrouiller », PIN expiré ou refusé). */
export function requestAdminPin(): void {
  clearAdminFinanceVerified();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ADMIN_PIN_EVENT));
  }
}
