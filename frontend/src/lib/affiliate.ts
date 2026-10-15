/**
 * Affiliation cote navigateur : le code ?ref= d'un lien partage est retenu 30 jours
 * (dernier lien clique), puis envoye avec la commande. Le serveur verifie tout.
 */
const STORAGE_KEY = "amazer_affiliate_ref";
const WINDOW_MS = 30 * 24 * 3600 * 1000;
const CODE_PATTERN = /^[A-Za-z0-9]{4,16}$/;

type StoredRef = { code: string; at: number };

export function captureAffiliateCode(search: string): string | null {
  const code = new URLSearchParams(search).get("ref")?.trim().toUpperCase();
  if (!code || !CODE_PATTERN.test(code)) return null;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, at: Date.now() } satisfies StoredRef));
  } catch {
    // stockage indisponible : l'attribution est simplement perdue
  }
  return code;
}

export function getActiveAffiliateCode(now = Date.now()): string | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const stored = JSON.parse(raw) as StoredRef;
    return stored.code && now - stored.at <= WINDOW_MS ? stored.code : undefined;
  } catch {
    return undefined;
  }
}

/** Ajoute (ou remplace) ?ref=CODE sur un lien AMAZER. */
export function withAffiliateRef(url: string, code: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("ref", code);
  return parsed.toString();
}
