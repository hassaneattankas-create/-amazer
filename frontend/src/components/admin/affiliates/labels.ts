import type { AffiliateEarningStatus } from "@/services/finance-service";

export const EARNING_STATUS: Record<AffiliateEarningStatus, { label: string; className: string }> = {
  pending: { label: "Délai de sécurité", className: "bg-surface-2 text-ink-700" },
  review: { label: "À vérifier", className: "bg-warning/25 text-ink-900" },
  available: { label: "Disponible", className: "bg-success/20 text-ink-900" },
  requested: { label: "Paiement demandé", className: "bg-info/15 text-ink-900" },
  paid: { label: "Payé", className: "bg-ink-900 text-white" },
  cancelled: { label: "Annulé", className: "bg-danger/10 text-danger" },
};

export const EARNING_KIND: Record<string, string> = {
  seller_subscription: "Abonnement vendeur",
  customer_bonus: "Nouveau client",
  bonus: "Prime",
};

export const PAYOUT_METHOD: Record<string, string> = {
  nita: "Nita",
  amana: "Amana",
  airtel: "Airtel Money",
  moov: "Moov Money",
};

export function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
}
