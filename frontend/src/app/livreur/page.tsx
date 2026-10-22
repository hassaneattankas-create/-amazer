"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Fuel, Pill, Truck } from "lucide-react";

import { WhatsAppButton } from "@/components/contact/WhatsAppButton";
import { DeliveryCard } from "@/components/courier/DeliveryCard";
import { useAdminMe } from "@/hooks/use-admin-me";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useNow } from "@/hooks/use-now";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  listAvailableDeliveries,
  listMyDeliveries,
  markDelivered,
  scanDeliveryReceipt,
  releaseDelivery,
  takeDelivery,
} from "@/services/courier-service";

type Tab = "available" | "mine";

export default function CourierPage() {
  const queryClient = useQueryClient();
  // isLoading (et non isPending) : pour un visiteur non connecte la requete est desactivee, jamais « en cours ».
  const { data: user, isLoading: userPending } = useCurrentUser();
  const { data: adminMe } = useAdminMe(Boolean(user?.id));
  const [tab, setTab] = useState<Tab>("available");
  const [message, setMessage] = useState("");
  const allowed = user?.role === "courier" || user?.role === "admin" || Boolean(adminMe?.is_admin);
  const now = useNow();

  const available = useQuery({
    queryKey: ["courier-available"],
    queryFn: listAvailableDeliveries,
    enabled: allowed,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const mine = useQuery({
    queryKey: ["courier-mine"],
    queryFn: listMyDeliveries,
    enabled: allowed,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["courier-available"] });
    void queryClient.invalidateQueries({ queryKey: ["courier-mine"] });
  };
  const action = useMutation({
    mutationFn: ({ kind, id }: { kind: "take" | "delivered" | "release"; id: string }) =>
      kind === "take" ? takeDelivery(id) : kind === "delivered" ? markDelivered(id) : releaseDelivery(id),
    onSuccess: (_order, variables) => {
      setMessage(
        variables.kind === "take"
          ? "Commande prise en charge. Retrouvez-la dans « Mes livraisons »."
          : variables.kind === "delivered"
            ? "Livraison confirmée. Merci !"
            : "Commande rendue : un autre livreur peut la prendre."
      );
      if (variables.kind === "take") setTab("mine");
      refresh();
    },
    onError: (error) => {
      setMessage(getApiErrorMessage(error, "Action impossible. Réessayez."));
      refresh();
    },
  });

  const scan = useMutation({
    mutationFn: scanDeliveryReceipt,
    onSuccess: (result) => {
      setMessage(result.status === "claimed" ? "Reçu valide : livraison confirmée. Merci !" : result.message);
      refresh();
    },
    onError: (error) => setMessage(getApiErrorMessage(error, "QR code non reconnu. Réessayez.")),
  });
  const { mutate: scanMutate } = scan;
  const onReceiptScanned = useCallback((raw: string) => scanMutate(raw), [scanMutate]);

  if (userPending) {
    return <section className="mx-auto max-w-3xl px-gutter py-8" aria-busy="true" />;
  }

  if (!allowed) {
    return (
      <section className="mx-auto max-w-xl px-gutter py-10">
        <div className="rounded-card border border-border bg-card p-8 text-center">
          <Truck className="mx-auto h-10 w-10 text-ink-400" aria-hidden="true" />
          <h1 className="mt-3 text-xl font-semibold text-ink-900">Espace livreurs</h1>
          <p className="mt-1 text-sm text-ink-600">Réservé aux livreurs AMAZER. Vous voulez livrer avec nous ?</p>
          {!user ? (
            <p className="mt-2 text-sm text-ink-600">
              Déjà livreur ?{" "}
              <Link href="/login?next=/livreur" className="font-semibold text-brand-700 hover:underline">
                Se connecter
              </Link>
            </p>
          ) : null}
          <div className="mt-5 flex justify-center">
            <WhatsAppButton label="Devenir livreur" message="Bonjour AMAZER, je souhaite devenir livreur." />
          </div>
        </div>
      </section>
    );
  }

  const list = tab === "available" ? available : mine;
  // Express d'abord, puis la plus ancienne (la plus urgente).
  const orders = [...(list.data ?? [])].sort(
    (a, b) =>
      Number(b.delivery_type === "express_niamey") - Number(a.delivery_type === "express_niamey") ||
      (tab === "available" ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime() : 0)
  );
  const activeMine = (mine.data ?? []).filter((order) => order.status === "livraison").length;
  const today = new Date(now).toDateString();
  const deliveredToday = (mine.data ?? []).filter((order) => order.delivered_at && new Date(order.delivered_at).toDateString() === today).length;
  const quickLink =
    "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-pill border border-border bg-card px-4 text-sm font-medium text-ink-800 hover:border-ink-400";

  return (
    <section className="mx-auto max-w-3xl px-gutter pb-16 pt-4">
      <h1 className="text-2xl font-semibold text-ink-900">Espace livreur</h1>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {(
          [
            ["À prendre", available.data?.length ?? 0],
            ["En cours", activeMine],
            ["Livrées aujourd'hui", deliveredToday],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-card border border-border bg-card px-2 py-3">
            <dd className="text-2xl font-semibold text-ink-900">{value}</dd>
            <dt className="text-xs text-ink-600">{label}</dt>
          </div>
        ))}
      </dl>

      <nav className="-mx-gutter mt-3 overflow-x-auto px-gutter" aria-label="Raccourcis livreur">
        <div className="flex gap-2">
          <Link href="/stations" className={quickLink}>
            <Fuel className="h-4 w-4 text-brand-600" aria-hidden="true" />
            Où trouver de l&apos;essence
          </Link>
          <Link href="/pharmacies" className={quickLink}>
            <Pill className="h-4 w-4 text-brand-600" aria-hidden="true" />
            Pharmacies
          </Link>
          <WhatsAppButton variant="outline" label="Contacter AMAZER" message="Bonjour AMAZER, je suis livreur et j'ai besoin d'aide." />
        </div>
      </nav>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-pill bg-surface-3 p-1" role="tablist">
        {(
          [
            ["available", `À prendre (${available.data?.length ?? 0})`],
            ["mine", `Mes livraisons (${activeMine})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`min-h-11 rounded-pill text-sm font-semibold transition-colors duration-fast ${
              tab === key ? "bg-card text-ink-900 shadow-resting" : "text-ink-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {message ? (
        <p className="mt-3 rounded-field bg-surface-1 px-3 py-2 text-sm text-ink-800" role="status">
          {message}
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {list.isPending ? (
          <div className="h-40 animate-pulse rounded-card bg-surface-3" aria-busy="true" />
        ) : list.isError ? (
          <p className="text-sm text-danger">Impossible de charger les commandes. Vérifiez votre connexion.</p>
        ) : orders.length === 0 ? (
          <p className="rounded-card border border-border bg-card p-6 text-center text-sm text-ink-600">
            {tab === "available" ? "Aucune commande à livrer pour le moment." : "Vous n'avez pas encore de livraison."}
          </p>
        ) : (
          orders.map((order) => (
            <DeliveryCard
              key={order.id}
              order={order}
              busy={action.isPending || scan.isPending}
              onTake={tab === "available" ? () => action.mutate({ kind: "take", id: order.id }) : undefined}
              onDelivered={() => action.mutate({ kind: "delivered", id: order.id })}
              onRelease={() => action.mutate({ kind: "release", id: order.id })}
              onReceiptScanned={onReceiptScanned}
            />
          ))
        )}
      </div>
    </section>
  );
}
