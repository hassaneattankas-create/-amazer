"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  Bus,
  CalendarClock,
  CreditCard,
  Crown,
  Flag,
  Star,
  Pill,
  RotateCcw,
  Share2,
  Store,
  Truck,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { useNow } from "@/hooks/use-now";
import { listAdminOfficialLists } from "@/services/admin-official-lists-service";
import {
  getTransportCommissions,
  listAdminOrders,
  listAdminPendingSellers,
  listAdminSellers,
  listAdminSellerSubscriptionPayments,
  listAffiliateEarnings,
  listAffiliatePayouts,
  listRefunds,
  listResellerEarnings,
  listResellerPayments,
  listVendorPayouts,
} from "@/services/finance-service";
import { listConversationReports, listDigitalProducts, listVendorReviewsAdmin } from "@/services/moderation-service";

type Tile = { href: string; label: string; hint: string; icon: LucideIcon; count: number | null; urgent?: boolean };

const DAY_MS = 24 * 3600 * 1000;
const WEEK_MS = 7 * DAY_MS;

function TileList({ tiles }: { tiles: Tile[] }) {
  // Ce qui attend quelque chose d'abord ; à égalité, l'ordre d'importance défini plus bas.
  const sorted = [...tiles].sort((a, b) => Number((b.count ?? 0) > 0) - Number((a.count ?? 0) > 0));
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {sorted.map((tile) => {
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
  );
}

/** Accueil admin : tout ce qui attend une action, puis ce qu'il faut contrôler ou savoir, avec le chemin direct. */
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
  const affiliates = useQuery({ queryKey: ["admin-affiliate-earnings"], queryFn: listAffiliateEarnings, retry: false });
  const vendorPayouts = useQuery({ queryKey: ["admin-vendor-payouts"], queryFn: listVendorPayouts, retry: false });
  const resellers = useQuery({ queryKey: ["admin-reseller-payments"], queryFn: listResellerPayments });
  const resellerGains = useQuery({ queryKey: ["admin-reseller-earnings"], queryFn: listResellerEarnings });
  const refunds = useQuery({ queryKey: ["admin-refunds", "to_refund"], queryFn: () => listRefunds("to_refund") });
  const reports = useQuery({ queryKey: ["admin-reports"], queryFn: listConversationReports });
  const sellers = useQuery({ queryKey: ["admin-sellers"], queryFn: listAdminSellers });
  const reviews = useQuery({ queryKey: ["admin-vendor-reviews"], queryFn: listVendorReviewsAdmin });
  const transport = useQuery({ queryKey: ["admin-transport-commissions", "current"], queryFn: () => getTransportCommissions(), retry: false });
  const digital = useQuery({ queryKey: ["admin-digital-products"], queryFn: () => listDigitalProducts(true), retry: false });
  const officialLists = useQuery({ queryKey: ["admin-official-lists"], queryFn: listAdminOfficialLists });

  const count = <T,>(q: { data?: T[]; isSuccess: boolean }, keep: (row: T) => boolean = () => true) =>
    q.isSuccess ? (q.data ?? []).filter(keep).length : null;
  const allOrders = orders.data ?? [];
  const pharmacyDutyOnline = (officialLists.data ?? []).some(
    (list) => list.kind === "pharmacy_duty" && new Date(list.starts_at).getTime() <= now && new Date(list.ends_at).getTime() > now
  );

  const actions: Tile[] = [
    {
      href: "/admin/finance",
      label: "Paiements de commandes à valider",
      hint: "Comparez la référence du client avec votre relevé.",
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
    {
      href: "/admin/affilies",
      label: "Candidatures d'ambassadeur",
      hint: "Lire la motivation, puis accepter ou refuser (onglet « Candidatures »).",
      icon: Crown,
      count: count(affiliates, (row) => Boolean(row.ambassador_applied_at) && row.tier !== "ambassador"),
      urgent: true,
    },
    { href: "/admin/affilies", label: "Retraits d'affiliés demandés", hint: "Payer puis saisir la référence.", icon: Share2, count: count(payouts) },
    {
      href: "/admin/affilies",
      label: "Gains d'affiliés à vérifier",
      hint: "Gains bloqués par la sécurité (plafond, trop d'inscriptions) : valider ou refuser.",
      icon: AlertTriangle,
      count: count(affiliates, (row) => row.review > 0),
    },
    {
      href: "/admin/reversements",
      label: "Argent à reverser aux boutiques",
      hint: "Commandes livrées et payées : reverser la part du vendeur.",
      icon: Wallet,
      count: count(vendorPayouts, (row) => row.to_pay > 0),
      urgent: true,
    },
    {
      href: "/admin/revendeurs",
      label: "Gains de revendeurs à verser",
      hint: "Verser la marge, puis « Enregistrer un versement ».",
      icon: Wallet,
      count: count(resellerGains, (r) => (r.to_pay ?? r.earned) > 0),
    },
    { href: "/admin/revendeurs", label: "Anciens paiements de revendeurs", hint: "Revendre est sans abonnement : traiter les derniers paiements.", icon: Wallet, count: count(resellers, (r) => r.status === "pending") },
    {
      href: "/admin/transport",
      label: "Commissions transport à encaisser",
      hint: "Part d'AMAZER sur les billets du mois, à réclamer aux compagnies.",
      icon: Bus,
      count: transport.isSuccess ? transport.data.rows.filter((row) => row.to_collect > 0).length : null,
    },
    {
      href: "/admin/moderation",
      label: "Produits numériques à valider",
      hint: "Un vendeur a coché « numérique » : valider un e-book, refuser un objet à livrer.",
      icon: AlertTriangle,
      count: count(digital),
      urgent: true,
    },
    { href: "/admin/remboursements", label: "Remboursements à faire", hint: "Commandes payées puis annulées.", icon: RotateCcw, count: count(refunds) },
    {
      href: "/admin/gardes",
      label: "Pharmacies de garde de la semaine",
      hint: "Aucune liste en ligne pour cette semaine : photographier l'affiche et la publier.",
      icon: Pill,
      count: officialLists.isSuccess ? (pharmacyDutyOnline ? 0 : 1) : null,
    },
  ];

  const checks: Tile[] = [
    {
      href: "/admin/moderation",
      label: "Signalements (7 derniers jours)",
      hint: "Conversations signalées par les clients ou vendeurs.",
      icon: Flag,
      count: count(reports, (r) => now - new Date(r.created_at).getTime() < WEEK_MS),
    },
    {
      href: "/admin/moderation",
      label: "Avis négatifs sur des boutiques (7 jours)",
      hint: "1 ou 2 étoiles : vérifier, masquer un avis insultant ou faux.",
      icon: Star,
      count: count(reviews, (r) => r.rating <= 2 && !r.is_hidden && now - new Date(r.created_at).getTime() < WEEK_MS),
    },
    {
      href: "/admin/tarifs",
      label: "Vendeurs pas encore vérifiés",
      hint: "Contrôler la boutique, puis lui donner le badge « Vérifié ».",
      icon: BadgeCheck,
      count: count(sellers, (s) => s.is_active && !s.is_verified),
    },
    {
      href: "/admin/tarifs",
      label: "Abonnements qui expirent dans 7 jours",
      hint: "Prévenir le vendeur pour qu'il renouvelle à temps.",
      icon: CalendarClock,
      count: count(sellers, (s) => {
        if (!s.subscription_paid_until) return false;
        const left = new Date(s.subscription_paid_until).getTime() - now;
        return left > 0 && left <= WEEK_MS;
      }),
    },
    {
      href: "/admin/tarifs",
      label: "Nouveaux vendeurs (7 derniers jours)",
      hint: "Pour savoir qui vient d'arriver sur AMAZER.",
      icon: Store,
      count: count(sellers, (s) => now - new Date(s.created_at).getTime() < WEEK_MS),
    },
  ];

  const total = (tiles: Tile[]) => tiles.reduce((sum, tile) => sum + (tile.count ?? 0), 0);
  const waiting = total(actions);
  const toCheck = total(checks);

  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">À traiter</h1>
        <p className="mt-1 text-sm text-ink-600">
          {waiting ? `${waiting} élément${waiting > 1 ? "s" : ""} en attente. Touchez une ligne pour le traiter.` : "Rien en attente pour le moment."}
        </p>
      </header>
      <Accordion defaultOpen={["actions", "checks"]} className="space-y-3">
        <AccordionItem
          id="actions"
          headingLevel={2}
          title="Actions à faire"
          description="Paiements, inscriptions, candidatures, reversements…"
          meta={waiting ? `${waiting} en attente` : "À jour"}
          tone={waiting ? "warning" : "default"}
        >
          <TileList tiles={actions} />
        </AccordionItem>
        <AccordionItem
          id="checks"
          headingLevel={2}
          title="À contrôler et à savoir"
          description="Signalements, avis, vérifications, abonnements qui finissent."
          meta={toCheck ? `${toCheck} à voir` : "Rien de nouveau"}
        >
          <TileList tiles={checks} />
        </AccordionItem>
      </Accordion>
    </section>
  );
}
