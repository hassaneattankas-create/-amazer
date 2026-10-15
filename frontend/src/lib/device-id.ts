/**
 * Identifiant anonyme de l'appareil (aleatoire, sans donnee personnelle), envoye en en-tete X-Device-Id.
 * Le serveur n'en garde qu'une empreinte : il sert a reperer l'auto-parrainage (affilie qui s'inscrit ou
 * commande lui-meme via son propre lien).
 */
const KEY = "amazer_device_id";
const PATTERN = /^[a-z0-9-]{16,64}$/;

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored && PATTERN.test(stored)) return stored;
    const created = randomId();
    window.localStorage.setItem(KEY, created);
    return created;
  } catch {
    return null; // stockage bloque : pas d'identifiant, le serveur s'appuie sur ses autres controles
  }
}
