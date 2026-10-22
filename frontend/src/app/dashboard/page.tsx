"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Package, Settings, UserRound } from "lucide-react";

import { MyBookings } from "@/components/account/MyBookings";
import { AffiliateShareCard } from "@/components/affiliate/AffiliateShareCard";
import { NotificationSettings } from "@/components/account/NotificationSettings";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { MobileBuildStamp } from "@/components/MobileBuildStamp";
import { OrderStepper } from "@/components/OrderStepper";
import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getHttpResponseStatus } from "@/lib/api-error";
import { getApiErrorMessage } from "@/lib/api-error";
import { CURRENCIES, LANGUAGES, countryName } from "@/lib/locale";
import { deleteMyAccount } from "@/services/auth-service";
import { isNotificationSoundEnabled, setNotificationSoundEnabled } from "@/services/notification-service";
import { listMyOrders } from "@/services/order-service";
import { useLocaleStore } from "@/store/locale-store";

const cardClass = "rounded-card border border-border bg-card p-5";

export default function DashboardPage() {
  const { data: user } = useCurrentUser();
  const { country, region, currency, language } = useLocaleStore();
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteStatus, setDeleteStatus] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(() => isNotificationSoundEnabled());

  const [showAllOrders, setShowAllOrders] = useState(false);
  const { data: orders = [], isPending: ordersPending, error: ordersError } = useQuery({
    queryKey: ["orders-me"],
    queryFn: listMyOrders,
    retry: false,
    // Statut a jour sans recharger : livraison confirmee par le livreur, la boutique, AMAZER ou le scan du recu.
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const deleteAccountMutation = useMutation({
    mutationFn: deleteMyAccount,
    onSuccess: () => {
      setDeleteStatus("Compte supprimé. Redirection…");
      window.location.assign("/login");
    },
    onError: (error) =>
      setDeleteStatus(getApiErrorMessage(error, "Suppression impossible. Vérifiez votre mot de passe.")),
  });

  function onDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeleteStatus("");
    if (!window.confirm("Supprimer définitivement votre compte ? Cette action ne peut pas être annulée.")) return;
    deleteAccountMutation.mutate({ password: deletePassword });
  }

  // Pas connecté : on invite à se connecter au lieu d'afficher un tableau vide trompeur.
  if (getHttpResponseStatus(ordersError) === 401) {
    return (
      <section className="mx-auto w-full max-w-xl px-gutter py-10">
        <div className={`${cardClass} text-center`}>
          <h1 className="text-xl font-semibold text-ink-900">Connectez-vous</h1>
          <p className="mt-1 text-sm text-ink-600">Retrouvez vos commandes, réservations et préférences.</p>
          <Button asChild className="mt-4">
            <Link href={`/login?next=${encodeURIComponent("/dashboard")}`}>Se connecter</Link>
          </Button>
        </div>
      </section>
    );
  }

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <section className="mx-auto w-full max-w-4xl space-y-4 px-gutter pb-14 pt-4">
      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-pill bg-ink-900 text-white">
          <UserRound className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Bonjour {user?.full_name?.split(" ")[0] ?? ""}</h1>
          {memberSince ? <p className="text-sm text-ink-600">Membre depuis le {memberSince}</p> : null}
        </div>
      </header>

      {user?.id ? <AffiliateShareCard variant="client" /> : null}

      <article className={cardClass}>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
          <Package className="h-5 w-5 text-brand-600" aria-hidden="true" />
          Mes commandes
        </h2>
        <div className="mt-4 space-y-4">
          {ordersPending ? (
            <div className="h-24 animate-pulse rounded-card bg-surface-3" aria-busy="true" />
          ) : orders.length ? (
            <>
              {(showAllOrders ? orders : orders.slice(0, 5)).map((order) => (
                <OrderStepper key={order.id} order={order} />
              ))}
              {orders.length > 5 && !showAllOrders ? (
                <Button type="button" variant="outline" onClick={() => setShowAllOrders(true)}>
                  Voir les {orders.length} commandes
                </Button>
              ) : null}
            </>
          ) : (
            <div className="text-sm text-ink-600">
              Aucune commande pour le moment.{" "}
              <Link href="/" className="font-medium text-brand-700 hover:underline">
                Découvrir les produits
              </Link>
            </div>
          )}
        </div>
      </article>

      <MyBookings />

      <NotificationSettings />

      <article className={cardClass}>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
          <Settings className="h-5 w-5 text-brand-600" aria-hidden="true" />
          Préférences
        </h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-600">Pays et région</dt>
            <dd className="font-medium text-ink-900">
              {countryName(country, language)}
              {region ? ` · ${region}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-ink-600">Devise d&apos;affichage</dt>
            <dd className="font-medium text-ink-900">
              {CURRENCIES.find((item) => item.code === currency)?.label ?? currency} (paiement en XOF)
            </dd>
          </div>
          <div>
            <dt className="text-ink-600">Langue</dt>
            <dd className="font-medium text-ink-900">{LANGUAGES.find((item) => item.code === language)?.label}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-600">Son des notifications</dt>
            <dd>
              <button
                type="button"
                role="switch"
                aria-checked={soundEnabled}
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  setNotificationSoundEnabled(next);
                }}
                className="min-h-11 rounded-field border border-border px-3 text-sm font-medium text-ink-900 hover:bg-surface-1"
              >
                {soundEnabled ? "Activé" : "Désactivé"}
              </button>
            </dd>
          </div>
        </dl>
        <div className="mt-3 flex items-center gap-2 text-sm text-ink-700">
          Modifier :
          <LocaleSwitcher />
        </div>
      </article>

      <article className="rounded-card border border-danger bg-card p-5">
        <h2 className="text-lg font-semibold text-danger">Supprimer mon compte</h2>
        <p className="mt-1 text-sm text-ink-700">
          Action définitive : vos données personnelles sont effacées. L&apos;historique des commandes est conservé.
        </p>
        <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center" onSubmit={onDeleteAccount}>
          <PasswordInput
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
            placeholder="Mot de passe actuel"
            required
            wrapperClassName="w-full sm:flex-1"
          />
          <Button
            type="submit"
            variant="outline"
            disabled={deleteAccountMutation.isPending || !deletePassword}
            className="border-danger text-danger"
          >
            {deleteAccountMutation.isPending ? "Suppression…" : "Supprimer mon compte"}
          </Button>
        </form>
        {deleteStatus ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {deleteStatus}
          </p>
        ) : null}
      </article>

      <MobileBuildStamp />
    </section>
  );
}
