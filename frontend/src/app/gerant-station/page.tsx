"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Fuel, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getApiErrorMessage } from "@/lib/api-error";
import { timeAgo } from "@/lib/local-services";
import { listManagedOutlets, updateManagedOutlet } from "@/services/local-services-service";
import { toast } from "@/store/toast-store";
import { FUEL_LABELS, FUEL_STATE_LABELS, type FuelKey, type FuelState, type ManagedOutlet } from "@/types/local-services";

const FUELS: FuelKey[] = ["super", "gasoil", "gaz"];
const STATES: { value: FuelState; label: string; on: string; off: string }[] = [
  { value: "available", label: "Disponible", on: "border-success bg-success text-white", off: "hover:border-success" },
  { value: "low", label: "Stock faible", on: "border-warning bg-warning text-ink-900", off: "hover:border-warning" },
  { value: "out", label: "Rupture", on: "border-danger bg-danger text-white", off: "hover:border-danger" },
];

function OutletPanel({ outlet }: { outlet: ManagedOutlet }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (payload: { fuel?: Partial<Record<FuelKey, FuelState>>; confirm?: boolean; done: string }) =>
      updateManagedOutlet(outlet.id, { fuel: payload.fuel, confirm: payload.confirm }),
    onSuccess: (data, variables) => {
      queryClient.setQueryData<ManagedOutlet[]>(["managed-outlets"], (prev) => prev?.map((o) => (o.id === data.id ? data : o)));
      toast.success(variables.done);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Mise à jour impossible. Réessayez.")),
  });
  const busy = mutation.isPending || !outlet.can_update;

  return (
    <section className="rounded-card border border-border bg-card p-4 shadow-resting">
      <h2 className="text-lg font-semibold text-ink-900">{outlet.name}</h2>
      <p className="text-sm text-ink-600">
        {outlet.brand_name} · {outlet.city}
        {outlet.via_region ? ` · vous êtes responsable de ${outlet.via_region}` : ""}
      </p>
      {!outlet.can_update ? (
        <p className="mt-3 rounded-field bg-warning/10 p-3 text-sm text-ink-800">
          Mises à jour suspendues : la station est fermée ou l&apos;abonnement de la marque a expiré. Prévenez le responsable.
        </p>
      ) : null}
      <div className="mt-4 space-y-3">
        {FUELS.map((fuel) => {
          const current = outlet.fuel[fuel] ?? null;
          return (
            <div key={fuel} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-base font-semibold text-ink-900">{FUEL_LABELS[fuel]}</span>
              <div className="grid flex-1 grid-cols-3 gap-2" role="group" aria-label={`${FUEL_LABELS[fuel]} à ${outlet.name}`}>
                {STATES.map((state) => (
                  <button
                    key={state.value}
                    type="button"
                    disabled={busy}
                    aria-pressed={current === state.value}
                    onClick={() => mutation.mutate({ fuel: { [fuel]: state.value }, done: `${FUEL_LABELS[fuel]} : ${FUEL_STATE_LABELS[state.value]}.` })}
                    className={`min-h-12 rounded-field border px-1 text-xs font-semibold sm:text-sm transition-colors duration-fast disabled:opacity-60 ${
                      current === state.value ? state.on : `border-border bg-card text-ink-700 ${state.off}`
                    }`}
                  >
                    {state.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className={`mt-4 flex flex-col gap-2 rounded-field p-3 sm:flex-row sm:items-center sm:justify-between ${outlet.fuel_fresh ? "bg-surface-1" : "bg-warning/10"}`}>
        <p className="flex items-start gap-2 text-sm text-ink-800">
          {outlet.fuel_fresh ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          )}
          {outlet.fuel_updated_at
            ? outlet.fuel_fresh
              ? `Mis à jour ${timeAgo(outlet.fuel_updated_at)}. À refaire dans les ${outlet.fresh_hours} h.`
              : `Dernière mise à jour ${timeAgo(outlet.fuel_updated_at)} : les clients la voient « non confirmée ».`
            : "Indiquez les disponibilités : les clients les voient tout de suite."}
        </p>
        {outlet.fuel_updated_at ? (
          <Button type="button" variant="outline" disabled={busy} onClick={() => mutation.mutate({ confirm: true, done: "Disponibilités confirmées." })}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Rien n&apos;a changé
          </Button>
        ) : null}
      </div>
    </section>
  );
}

/** Espace du gérant : seulement les stations qui lui sont confiées, et seulement leurs disponibilités. */
export default function StationManagerPage() {
  // isLoading (et non isPending) : pour un visiteur non connecté la requête est désactivée, jamais « en cours ».
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const loggedIn = Boolean(user?.id);
  const outlets = useQuery({ queryKey: ["managed-outlets"], queryFn: listManagedOutlets, enabled: loggedIn, refetchOnWindowFocus: true });

  return (
    <section className="mx-auto w-full max-w-2xl space-y-4 px-gutter pb-14 pt-4">
      <header>
        <h1 className="flex items-center gap-2 text-display-sm font-semibold tracking-display text-ink-900">
          <Fuel className="h-7 w-7 text-brand-600" aria-hidden="true" />
          Gérant de station
        </h1>
        <p className="mt-1 text-sm text-ink-600">Indiquez ce qui est disponible, en un geste. Les clients le voient tout de suite sur AMAZER.</p>
      </header>

      {userLoading ? (
        <div className="h-40 animate-pulse rounded-card bg-surface-3" aria-busy="true" />
      ) : !loggedIn ? (
        <div className="rounded-card border border-border bg-card p-5 text-center">
          <p className="font-semibold text-ink-900">Connectez-vous avec le compte que le responsable de la station a ajouté.</p>
          <div className="mt-3 flex justify-center gap-2">
            <Button asChild>
              <Link href="/login?next=/gerant-station">Se connecter</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/register?next=/gerant-station">Créer un compte</Link>
            </Button>
          </div>
        </div>
      ) : outlets.isPending ? (
        <div className="h-40 animate-pulse rounded-card bg-surface-3" aria-busy="true" />
      ) : outlets.isError ? (
        <div className="rounded-card border border-border bg-card p-5 text-center">
          <p className="text-sm text-danger">Stations indisponibles pour le moment.</p>
          <Button type="button" variant="outline" className="mt-3" onClick={() => void outlets.refetch()}>
            Réessayer
          </Button>
        </div>
      ) : outlets.data.length === 0 ? (
        <div className="rounded-card border border-border bg-card p-5 text-sm text-ink-700">
          <p className="font-semibold text-ink-900">Aucune station ne vous est confiée pour l&apos;instant.</p>
          <p className="mt-1">
            Donnez au responsable de la station l&apos;e-mail de ce compte : <strong className="break-all">{user?.email}</strong>. Il vous ajoute depuis son
            espace vendeur, puis la station apparaît ici.
          </p>
        </div>
      ) : (
        outlets.data.map((outlet) => <OutletPanel key={outlet.id} outlet={outlet} />)
      )}
    </section>
  );
}
