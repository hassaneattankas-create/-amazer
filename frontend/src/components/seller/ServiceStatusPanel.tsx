"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Fuel, LocateFixed, MapPin, Moon, Pill, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { timeAgo } from "@/lib/local-services";
import { getServiceStatus, updateServiceStatus } from "@/services/local-services-service";
import { toast } from "@/store/toast-store";
import { FUEL_LABELS, type FuelKey, type FuelState, type ServiceKind, type ServiceStatusUpdate } from "@/types/local-services";

const FUELS: FuelKey[] = ["super", "gasoil", "gaz"];
const fieldClass =
  "mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-base text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

function frDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

/** Panneau du gérant : garde (pharmacie) ou disponibilités (station), en un geste depuis le téléphone. */
export function ServiceStatusPanel({ kind }: { kind: ServiceKind }) {
  const queryClient = useQueryClient();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [locating, setLocating] = useState(false);
  const { data: status, isPending, isError, refetch } = useQuery({ queryKey: ["service-status"], queryFn: getServiceStatus });

  const mutation = useMutation({
    mutationFn: (payload: ServiceStatusUpdate & { done?: string }) => {
      const { done, ...body } = payload;
      void done;
      return updateServiceStatus(body);
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["service-status"], data);
      if (variables.done) toast.success(variables.done);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Mise à jour impossible. Réessayez.")),
  });

  const savePosition = () => {
    if (!("geolocation" in navigator)) {
      toast.error("La localisation n'est pas disponible sur cet appareil.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        mutation.mutate({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, done: "Position enregistrée : l'itinéraire mène maintenant chez vous." });
      },
      () => {
        setLocating(false);
        toast.error("Position introuvable. Autorisez la localisation pour AMAZER, puis réessayez sur place.");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  if (isPending) return <div className="h-48 animate-pulse rounded-card border border-border bg-surface-1" aria-busy="true" />;
  if (isError || !status) {
    return (
      <div className="rounded-card border border-border bg-card p-4 text-sm text-ink-700">
        Impossible de charger votre statut.{" "}
        <button type="button" className="font-semibold text-brand-700 underline" onClick={() => void refetch()}>
          Réessayer
        </button>
      </div>
    );
  }

  const busy = mutation.isPending;
  const Icon = kind === "pharmacy" ? Pill : Fuel;

  return (
    <section className="rounded-card border border-border bg-card p-4 shadow-resting sm:p-5" aria-labelledby="service-status-title">
      <h2 id="service-status-title" className="flex items-center gap-2 text-lg font-semibold text-ink-900">
        <Icon className="h-5 w-5 text-brand-600" aria-hidden="true" />
        {kind === "pharmacy" ? "Ma garde" : "Mes disponibilités"}
      </h2>

      {kind === "pharmacy" ? (
        <div className="mt-3 space-y-4">
          <div className={`rounded-field p-4 ${status.on_duty_now ? "bg-success/10" : "bg-surface-1"}`}>
            <p className={`flex items-center gap-2 text-base font-semibold ${status.on_duty_now ? "text-success" : "text-ink-800"}`}>
              <Moon className="h-5 w-5" aria-hidden="true" />
              {status.on_duty_now ? status.duty_label ?? "Vous êtes de garde" : "Vous n'êtes pas de garde"}
            </p>
            <p className="mt-1 text-sm text-ink-600">
              {status.on_duty_now ? "Vous apparaissez en tête de « Pharmacies de garde »." : "Activez la garde pour apparaître en tête de « Pharmacies de garde »."}
            </p>
            {/* Garde programmee en cours : rien a activer ; elle s'arrete seule (ou via « Supprimer »). */}
            {status.on_duty_now && !status.on_duty ? null : (
            <Button
              type="button"
              size="lg"
              disabled={busy}
              aria-pressed={status.on_duty}
              className={`mt-3 w-full sm:w-auto ${status.on_duty ? "" : "bg-success text-white hover:bg-success/90"}`}
              variant={status.on_duty ? "outline" : "default"}
              onClick={() =>
                mutation.mutate({ on_duty: !status.on_duty, done: status.on_duty ? "Garde terminée." : "Vous êtes de garde : les clients vous voient en premier." })
              }
            >
              {status.on_duty ? "Terminer ma garde" : "Je suis de garde maintenant"}
            </Button>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-ink-900">Programmer une garde</p>
            <p className="text-sm text-ink-600">Elle s&apos;active et s&apos;arrête toute seule aux dates choisies (31 jours au plus).</p>
            {status.duty_start && status.duty_end ? (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-800">
                Garde programmée du <strong>{frDate(status.duty_start)}</strong> au <strong>{frDate(status.duty_end)}</strong>.
                <button
                  type="button"
                  disabled={busy}
                  className="font-semibold text-brand-700 underline"
                  onClick={() => mutation.mutate({ clear_duty_period: true, done: "Garde programmée supprimée." })}
                >
                  Supprimer
                </button>
              </p>
            ) : null}
            <form
              className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                if (!start || !end) {
                  toast.error("Choisissez la date de début et la date de fin.");
                  return;
                }
                mutation.mutate({ duty_start: start, duty_end: end, done: "Garde programmée." });
              }}
            >
              <label className="text-sm font-medium text-ink-800">
                Du
                <input type="date" className={fieldClass} value={start} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label className="text-sm font-medium text-ink-800">
                Au
                <input type="date" className={fieldClass} value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
              </label>
              <Button type="submit" size="lg" variant="outline" disabled={busy}>
                Programmer
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {FUELS.map((fuel) => {
            const current = status.fuel[fuel] ?? null;
            const choose = (state: FuelState) =>
              mutation.mutate({ fuel: { [fuel]: state }, done: `${FUEL_LABELS[fuel]} : ${state === "available" ? "disponible" : "en rupture"}.` });
            return (
              <div key={fuel} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-base font-semibold text-ink-900">{FUEL_LABELS[fuel]}</span>
                <div className="grid flex-1 grid-cols-2 gap-2" role="group" aria-label={FUEL_LABELS[fuel]}>
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={current === "available"}
                    onClick={() => choose("available")}
                    className={`min-h-12 rounded-field border text-sm font-semibold transition-colors duration-fast ${
                      current === "available" ? "border-success bg-success text-white" : "border-border bg-card text-ink-700 hover:border-success"
                    }`}
                  >
                    Disponible
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={current === "out"}
                    onClick={() => choose("out")}
                    className={`min-h-12 rounded-field border text-sm font-semibold transition-colors duration-fast ${
                      current === "out" ? "border-danger bg-danger text-white" : "border-border bg-card text-ink-700 hover:border-danger"
                    }`}
                  >
                    Rupture
                  </button>
                </div>
              </div>
            );
          })}
          <div className={`flex flex-col gap-2 rounded-field p-3 sm:flex-row sm:items-center sm:justify-between ${status.fuel_fresh ? "bg-surface-1" : "bg-warning/10"}`}>
            <p className="flex items-start gap-2 text-sm text-ink-800">
              {status.fuel_fresh ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              )}
              {status.fuel_updated_at
                ? status.fuel_fresh
                  ? `Mis à jour ${timeAgo(status.fuel_updated_at)}.`
                  : `Dernière mise à jour ${timeAgo(status.fuel_updated_at)} : les clients la voient « à confirmer ».`
                : "Indiquez vos disponibilités : les clients les voient tout de suite."}
            </p>
            {status.fuel_updated_at ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => mutation.mutate({ fuel: status.fuel, done: "Disponibilités confirmées." })}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Rien n&apos;a changé
              </Button>
            ) : null}
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-border pt-4">
        <p className="flex items-start gap-2 text-sm text-ink-700">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
          {status.latitude != null
            ? "Position enregistrée : le bouton « Itinéraire » mène les clients jusqu'à vous dans Google Maps."
            : "Enregistrez votre position une fois, depuis votre établissement, pour un itinéraire Google Maps exact."}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy || locating} onClick={savePosition}>
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
            {locating ? "Localisation…" : status.latitude != null ? "Mettre à jour ma position" : "Enregistrer ma position"}
          </Button>
          <a href={status.maps_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center text-sm font-medium text-brand-700 hover:underline">
            Voir sur Google Maps
          </a>
        </div>
        <p className="mt-3 text-xs text-ink-600">
          {status.delivery_phone
            ? "Les clients peuvent se faire livrer depuis chez vous par AMAZER."
            : "La livraison AMAZER n'est pas encore disponible dans votre ville."}
        </p>
      </div>
    </section>
  );
}
