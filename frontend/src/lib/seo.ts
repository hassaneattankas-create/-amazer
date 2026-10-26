/**
 * Référencement côté serveur : lecture de l'API publique pour les titres, aperçus de partage
 * (WhatsApp, Facebook) et données structurées Google. Jamais bloquant : en cas d'échec, null.
 */
import { getBackendOriginFromEnv } from "@/lib/backend-origin";

export const SITE_URL = "https://amazer.store";

export async function fetchPublicApi<T>(path: string, revalidateSeconds = 600): Promise<T | null> {
  try {
    const response = await fetch(`${getBackendOriginFromEnv().replace(/\/$/, "")}${path}`, {
      next: { revalidate: revalidateSeconds },
      signal: AbortSignal.timeout(8000),
    });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Texte court pour une description (Google en affiche environ 155 caractères). */
export function shortText(value: string | null | undefined, max = 155): string {
  const clean = (value ?? "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Script JSON-LD sûr (empêche la fermeture prématurée de la balise). */
export function jsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
