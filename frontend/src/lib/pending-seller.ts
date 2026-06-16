// Pre-inscription vendeur en attente, memorisee sur l'appareil qui a soumis la
// demande. Permet a l'app de prevenir l'utilisateur que son compte est pret
// AVANT meme qu'il se connecte (on interroge le statut public par id opaque).

const STORAGE_KEY = "amazer_pending_seller_prereg";

/** Evenement emis quand la pre-inscription locale change (pour reveiller le poller). */
export const PENDING_SELLER_EVENT = "amazer:pending-seller-updated";

function emitChange(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(PENDING_SELLER_EVENT));
  } catch {
    /* silencieux */
  }
}

export type PendingSellerPreReg = {
  id: string;
  identifier: string;
  businessName?: string;
  /** true des qu'on a notifie l'utilisateur de l'approbation (evite les doublons). */
  notified?: boolean;
};

export function getPendingSellerPreReg(): PendingSellerPreReg | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSellerPreReg;
    return parsed && typeof parsed.id === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function setPendingSellerPreReg(value: PendingSellerPreReg): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    emitChange();
  } catch {
    /* silencieux */
  }
}

export function clearPendingSellerPreReg(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    emitChange();
  } catch {
    /* silencieux */
  }
}
