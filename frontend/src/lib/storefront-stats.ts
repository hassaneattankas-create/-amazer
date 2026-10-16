/**
 * Statistiques des vitrines cote navigateur : une visite comptee par jour et par telephone,
 * un contact compte une fois par session (appel, WhatsApp, message). Envoi silencieux.
 */
import { recordStorefrontEvent } from "@/services/seller-service";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function once(storage: Storage | undefined, key: string): boolean {
  try {
    if (!storage || storage.getItem(key)) return false;
    storage.setItem(key, "1");
    return true;
  } catch {
    return false; // stockage bloque : on ne compte pas (statistique seulement)
  }
}

export function trackStorefrontView(vendorId: string): void {
  if (typeof window === "undefined" || !vendorId) return;
  if (once(window.localStorage, `amazer_sf_view_${vendorId}_${todayKey()}`)) {
    void recordStorefrontEvent(vendorId, "view").catch(() => undefined);
  }
}

export function trackStorefrontContact(vendorId: string): void {
  if (typeof window === "undefined" || !vendorId) return;
  if (once(window.sessionStorage, `amazer_sf_contact_${vendorId}`)) {
    void recordStorefrontEvent(vendorId, "contact").catch(() => undefined);
  }
}
