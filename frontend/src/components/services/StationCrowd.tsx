"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Users } from "lucide-react";

import { useCurrentUser } from "@/hooks/use-current-user";
import { getApiErrorMessage } from "@/lib/api-error";
import { timeAgo } from "@/lib/local-services";
import { addFuelAlert, reportFuelSignal } from "@/services/local-services-service";
import { toast } from "@/store/toast-store";
import { FUEL_LABELS, type FuelKey, type LocalServiceItem } from "@/types/local-services";

const FUELS: FuelKey[] = ["super", "gasoil", "gaz"];
const chip =
  "inline-flex min-h-10 items-center rounded-pill border border-border bg-card px-3 text-xs font-semibold text-ink-800 hover:border-ink-400 disabled:opacity-60";

type Step = null | "found" | "out" | "alert";

/** Ce que des clients ont signalé sur place (2 dernières heures), distinct de l'information de la station. */
function CrowdLine({ item }: { item: LocalServiceItem }) {
  if (!item.crowd_at) return null;
  const parts = [
    ...(item.crowd_found ?? []).map((f) => `${FUEL_LABELS[f]} trouvé`),
    ...(item.crowd_out ?? []).map((f) => `${FUEL_LABELS[f]} : plus rien`),
    ...((item.crowd_queue ?? 0) > 0 ? [(item.crowd_queue ?? 0) > 1 ? `longue file (${item.crowd_queue} signalements)` : "longue file"] : []),
  ];
  if (!parts.length) return null;
  return (
    <p className="mt-2 flex items-start gap-1.5 rounded-field bg-surface-1 px-2.5 py-1.5 text-xs text-ink-800">
      <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden="true" />
      <span>
        Selon des clients ({timeAgo(item.crowd_at)}) : {parts.join(" · ")}
      </span>
    </p>
  );
}

/**
 * Station : « Vous y êtes ? » (il y en a / plus rien / longue file, en un geste, sans compte) et « Me prévenir »
 * (alerte dès que la station indique du carburant ; compte nécessaire pour recevoir la notification).
 */
export function StationCrowd({ item }: { item: LocalServiceItem }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const [step, setStep] = useState<Step>(null);

  const signal = useMutation({
    mutationFn: (payload: { kind: "found" | "out" | "queue"; fuel?: FuelKey }) =>
      reportFuelSignal({ vendor_id: item.vendor_id, outlet_id: item.outlet_id ?? null, ...payload }),
    onSuccess: () => {
      setStep(null);
      toast.success("Merci ! Les autres clients le voient tout de suite.");
      void queryClient.invalidateQueries({ queryKey: ["local-services"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Signalement impossible pour le moment.")),
  });

  const alert = useMutation({
    mutationFn: (fuel: FuelKey | "any") =>
      addFuelAlert(item.outlet_id ? { fuel, outlet_id: item.outlet_id } : { fuel, vendor_id: item.vendor_id }),
    onSuccess: (created) => {
      setStep(null);
      toast.success(`Alerte enregistrée : ${created.label}. Vous serez prévenu dès que la station en a.`);
      void queryClient.invalidateQueries({ queryKey: ["fuel-alerts"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Alerte impossible pour le moment.")),
  });

  const askAlert = () => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent("/stations")}`);
      return;
    }
    setStep(step === "alert" ? null : "alert");
  };

  return (
    <div className="mt-2">
      <CrowdLine item={item} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-ink-700">Vous y êtes ?</span>
        <button type="button" className={chip} disabled={signal.isPending} onClick={() => setStep(step === "found" ? null : "found")} aria-expanded={step === "found"}>
          Il y en a
        </button>
        <button type="button" className={chip} disabled={signal.isPending} onClick={() => setStep(step === "out" ? null : "out")} aria-expanded={step === "out"}>
          Plus rien
        </button>
        <button type="button" className={chip} disabled={signal.isPending} onClick={() => signal.mutate({ kind: "queue" })}>
          Longue file
        </button>
      </div>
      {step === "found" || step === "out" ? (
        <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Quel carburant ?">
          <span className="text-xs text-ink-600">Quel carburant ?</span>
          {FUELS.map((fuel) => (
            <button key={fuel} type="button" className={chip} disabled={signal.isPending} onClick={() => signal.mutate({ kind: step, fuel })}>
              {FUEL_LABELS[fuel]}
            </button>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        onClick={askAlert}
        aria-expanded={step === "alert"}
        className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        Me prévenir quand il y en a
      </button>
      {step === "alert" ? (
        <div className="mt-1 flex flex-wrap items-center gap-2" role="group" aria-label="Carburant à surveiller">
          {[...FUELS, "any" as const].map((fuel) => (
            <button key={fuel} type="button" className={chip} disabled={alert.isPending} onClick={() => alert.mutate(fuel)}>
              {fuel === "any" ? "N'importe lequel" : FUEL_LABELS[fuel]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
