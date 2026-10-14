"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Mail, Package, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatXOF } from "@/lib/currency";
import { getReceiptLink, listMyOrders } from "@/services/order-service";

/**
 * Page de confirmation a la maniere d'Amazon : merci, numero de commande, statut reel
 * (paye ou paiement en verification), etapes suivantes et actions utiles.
 */
export function OrderConfirmation({ orderId }: { orderId: string }) {
  const { data: orders, isPending } = useQuery({
    queryKey: ["orders-me"],
    queryFn: listMyOrders,
    enabled: Boolean(orderId),
    retry: 1,
  });
  const order = orders?.find((item) => item.id === orderId);
  const { data: receipt } = useQuery({
    queryKey: ["receipt-link", orderId],
    queryFn: () => getReceiptLink(orderId),
    enabled: Boolean(order),
    retry: 3,
    staleTime: 60_000,
  });

  if (isPending) {
    return (
      <section className="mx-auto w-full max-w-2xl px-gutter py-6" aria-busy="true">
        <div className="h-64 animate-pulse rounded-card bg-surface-3" />
      </section>
    );
  }

  if (!order) {
    return (
      <section className="mx-auto w-full max-w-2xl px-gutter py-6">
        <div className="rounded-card border border-border bg-card p-6 text-center">
          <h1 className="text-xl font-semibold text-ink-900">Commande introuvable</h1>
          <p className="mt-1 text-sm text-ink-600">Connectez-vous avec le compte qui a passé la commande.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard">Mes commandes</Link>
            </Button>
            <Button asChild>
              <Link href="/">Accueil</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const paid = order.payment_status === "paid";
  const steps = [
    { icon: CheckCircle2, label: "Commande reçue", done: true },
    { icon: Clock, label: "Paiement vérifié par AMAZER", done: paid },
    { icon: Package, label: "Préparation par la boutique", done: ["preparation", "livraison", "recu"].includes(order.status) },
    { icon: Truck, label: "Livraison", done: order.status === "recu" },
  ];

  return (
    <section className="mx-auto w-full max-w-2xl space-y-4 px-gutter py-6">
      <div className="rounded-card border border-border bg-card p-6">
        <CheckCircle2 className="h-10 w-10 text-success" aria-hidden="true" />
        <h1 className="mt-2 text-2xl font-semibold text-ink-900">Merci, votre commande est enregistrée</h1>
        <p className="mt-1 text-sm text-ink-700">
          Commande <span className="font-semibold">#{order.tracking_code ?? order.id.slice(0, 8).toUpperCase()}</span> ·{" "}
          {formatXOF(order.total_amount)}
        </p>
        <p className={`mt-3 rounded-field px-3 py-2 text-sm ${paid ? "bg-surface-1 text-success" : "bg-surface-1 text-ink-800"}`}>
          {paid
            ? "Paiement confirmé. La boutique prépare votre commande."
            : "Paiement en cours de vérification par AMAZER. La préparation commence dès la confirmation."}
        </p>

        <ol className="mt-5 space-y-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <li key={step.label} className="flex items-center gap-3 text-sm">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-pill ${
                    step.done ? "bg-success text-white" : "bg-surface-3 text-ink-600"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className={step.done ? "font-medium text-ink-900" : "text-ink-600"}>{step.label}</span>
                <span className="sr-only">{step.done ? " : fait" : " : à venir"}</span>
              </li>
            );
          })}
        </ol>

        <p className="mt-5 flex items-center gap-2 text-sm text-ink-700">
          <Mail className="h-4 w-4 shrink-0 text-ink-600" aria-hidden="true" />
          Vous êtes prévenu à chaque étape, sur le site et par e-mail.
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {receipt?.receipt_url ? (
            <Button asChild>
              <Link href={receipt.receipt_url}>Mon reçu</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/dashboard">Suivre ma commande</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Continuer mes achats</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
