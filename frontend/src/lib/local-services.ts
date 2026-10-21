/** Utilitaires des pages Pharmacies de garde / Stations-essence. */

export type GeoPoint = { lat: number; lng: number };

/** Chefs-lieux des 8 régions du Niger : toujours proposés dans le choix de la ville. */
export const NIGER_REGION_CITIES = ["Niamey", "Agadez", "Diffa", "Dosso", "Maradi", "Tahoua", "Tillabéri", "Zinder"];

/** Distance à vol d'oiseau en km (formule de haversine). */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  return `${km.toLocaleString("fr-FR", { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;
}

/** « il y a 20 min », « il y a 3 h », « hier » … */
export function timeAgo(iso: string | null, now: number = Date.now()): string | null {
  if (!iso) return null;
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return days <= 1 ? "hier" : `il y a ${days} jours`;
}

/** Chiffres seuls, indicatif +227 ajouté aux numéros nigériens à 8 chiffres. */
export function internationalDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 8) return `227${digits}`;
  return digits.startsWith("00") ? digits.slice(2) : digits;
}

export function telHref(phone: string): string {
  return `tel:+${internationalDigits(phone)}`;
}

export function whatsappHref(phone: string, message: string): string {
  return `https://wa.me/${internationalDigits(phone)}?text=${encodeURIComponent(message)}`;
}
