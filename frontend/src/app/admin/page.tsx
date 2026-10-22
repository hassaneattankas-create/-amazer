"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Flag, RotateCcw, Share2, Store, Truck, UserPlus, Wallet, type LucideIcon } from "lucide-react";

import { useNow } from "@/hooks/use-now";
import {
  listAdminOrders,
  listAdminPendingSellers,
  listAdminSellerSubscriptionPayments,
  listAffiliatePayouts,
  listRefunds,
  listResellerEarnings,
  listResellerPayments,
} from "@/services/finance-service";
import { listConversationReports } from "@/services/moderation-service";

type Tile = { href: string; label: string; hint: string; icon: LucideIcon; count: number | null; urgent?: boolean };

const WEEK_MS = 7 * 24 * 3600 * 1000;

/** Accueil admin : uniquement ce qui attend une action, avec le chemin direct pour la faire. */
export default function AdminHomePage() {
  const now = useNow();
  const orders = useQuery({ queryKey: ["admin-orders"], queryFn: () => listAdminOrders(80), refetchInterval: 15000 });
  const preRegs = useQuery({ queryKey: ["admin-pending-sellers"], queryFn: () => listAdminPendingSellers("pending"), refetchInterval: 30000 });
  const sellerPays = useQuery({
    queryKey: ["admin-seller-subscription-payments"],
    queryFn: () => listAdminSellerSubscriptionPayments("pending", 100),
    refetchInterval: 30000,
  });
  const payouts = useQuery({ queryKey: ["admin-affiliate-payouts", "requested"], queryFn: () => listAffiliatePayouts("requested") });
  const resellers = useQuery({ queryKey: ["admin-reseller-payments"], queryFn: listResellerPayments });
  const resellerGains = useQuery({ queryKey: ["admin-reseller-earnings"], queryFn: listResellerEarnings });
  const refunds = useQuery({ queryKey: ["admin-refunds", "to_refund"], queryFn: () => listRefunds("to_refund") });
  const reports = useQuery({ queryKey: ["admin-reports"], queryFn: listConversationReports });

  const count = <T,>(q: { data?: T[]; isSuccess: boolean }, keep: (row: T) => boolean = () => true) =>
    q.isSuccess ? (q.data ?? []).filter(keep).length : null;
  const allOrders = orders.data ?? [];

  const tiles: Tile[] = [
    {
      href: "/admin/finance",
      label: "Paiements de commandes à valider",
      hint: "Nita : comparez la référence du client avec votre relevé.",
      icon: CreditCard,
      count: orders.isSuccess ? allOrders.filter((o) => (o.payment_status ?? "paid") !== "paid" && o.status !== "annulee").length : null,
      urgent: true,
    },
    {
      href: "/admin/finance",
      label: "Commandes payées à livrer",
      hint: "Suivi jusqu'à la livraison.",
      icon: Truck,
      count: orders.isSuccess
        ? allOrders.filter((o) => o.kind !== "restaurant" && (o.payment_status ?? "paid") === "paid" && !["recu", "CLAIMED", "annulee"].includes(o.status)).length
        : null,
    },
    { href: "/admin/finance", label: "Inscriptions vendeurs à valider", hint: "Vérifier le paiement, puis créer la boutique.", icon: UserPlus, count: count(preRegs), urgent: true },
    { href: "/admin/finance", label: "Abonnements vendeurs à valider", hint: "Renouvellements et changements de formule.", icon: Store, count: count(sellerPays), urgent: true },
    { href: "/admin/affilies", label: "Retraits d'affiliés demandés", hint: "Payer puis saisir la référence.", icon: Share2, count: count(payouts) },
    { href: "/admin/revendeurs", label: "Abonnements revendeurs à valider", hint: "Vérifier le paiement.", icon: Wallet, count: count(resellers, (r) => r.status === "pending") },
    {
      href: "/admin/revendeurs",
      label: "Gains de revendeurs à verser",
      hint: "Verser la marge, puis « Enregistrer un versement ».",
      icon: Wallet,
      count: count(resellerGains, (r) => (r.to_pay ?? r.earned) > 0),
    },
    { href: "/admin/remboursements", label: "Remboursements à faire", hint: "Commandes payées puis annulées.", icon: RotateCcw, count: count(refunds) },
    {
      href: "/admin/moderation",
      label: "Signalements (7 derniers jours)",
      hint: "Conversations signalées par les clients ou vendeurs.",
      icon: Flag,
      count: count(reports, (r) => now - new Date(r.created_at).getTime() < WEEK_MS),
    },
  ];
  const waiting = tiles.reduce((sum, tile) => sum + (tile.count ?? 0), 0);

  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">À traiter</h1>
        <p className="mt-1 text-sm text-ink-600">
          {waiting ? `${waiting} élément${waiting > 1 ? "s" : ""} en attente. Touchez une ligne pour le traiter.` : "Rien en attente pour le moment."}
        </p>
      </header>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          const active = (tile.count ?? 0) > 0;
          return (
            <Link
              key={tile.label}
              href={tile.href}
              className={`flex items-center gap-3 rounded-card border p-4 transition-colors duration-fast ${
                active ? (tile.urgent ? "border-brand-300 bg-brand-50" : "border-ink-300 bg-card") : "border-border bg-card opacity-80"
              } hover:border-ink-400`}
            >
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-field ${active ? "bg-brand-600 text-white" : "bg-surface-2 text-ink-500"}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink-900">{tile.label}</span>
                <span className="block text-sm text-ink-600">{tile.hint}</span>
              </span>
              <span className={`text-2xl font-semibold ${active ? "text-ink-900" : "text-ink-400"}`} aria-label={`${tile.count ?? "?"} en attente`}>
                {tile.count ?? "…"}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
