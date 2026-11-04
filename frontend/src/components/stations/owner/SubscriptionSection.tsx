"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { downloadFuelExport, getFuelNetwork, getFuelPlan } from "@/services/local-services-service";
import { toast } from "@/store/toast-store";
import type { FuelNetwork } from "@/types/local-services";

const EXPORTS = [
  { kind: "history", label: "Historique (12 mois)", file: "amazer-stations-historique.csv" },
  { kind: "stats", label: "Statistiques (12 mois)", file: "amazer-stations-statistiques.csv" },
] as const;

function priceLine(network: FuelNetwork): string {
  if (network.negotiated != null) return `Prix négocié : ${formatXOF(network.negotiated)} par mois, toutes stations comprises.`;
  // extra = montant total des stations au-delà des incluses (pas un prix unitaire).
  const included = `${network.included} station${network.included > 1 ? "s" : ""} incluse${network.included > 1 ? "s" : ""}`;
  const beyond = Math.max(0, network.stations - network.included);
  const extra = network.extra && beyond ? ` + ${formatXOF(network.extra)} pour ${beyond} station${beyond > 1 ? "s" : ""} en plus` : "";
  return `${formatXOF(network.total)} par mois : abonnement ${formatXOF(network.base)} (${included})${extra}.`;
}

function ExportButtons() {
  const [busy, setBusy] = useState(false);
  const download = async (kind: (typeof EXPORTS)[number]) => {
    setBusy(true);
    try {
      const blob = await downloadFuelExport(kind.kind);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = kind.file;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Export impossible. Réessayez."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {EXPORTS.map((kind) => (
        <Button key={kind.kind} type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => void download(kind)}>
          <Download className="h-4 w-4" aria-hidden="true" />
          {kind.label}
        </Button>
      ))}
    </div>
  );
}

/** Palier, prix de l'abonnement et export pour Excel (ouvert à toutes les marques). */
export function SubscriptionSection() {
  const plan = useQuery({ queryKey: ["fuel-plan"], queryFn: getFuelPlan });
  const network = useQuery({ queryKey: ["fuel-network"], queryFn: getFuelNetwork });

  if (plan.isPending || network.isPending) return <div className="h-20 animate-pulse rounded-field bg-surface-2" aria-busy="true" aria-label="Chargement" />;
  if (!plan.data || !network.data) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-field bg-surface-1 p-3 text-sm">
        <p className="text-ink-800">Abonnement expiré ou indisponible pour le moment.</p>
        <Button asChild size="sm" className="min-h-11">
          <Link href="/seller">Voir mon abonnement</Link>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-11"
          onClick={() => {
            void plan.refetch();
            void network.refetch();
          }}
        >
          Réessayer
        </Button>
      </div>
    );
  }
  const { stations } = network.data;

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-field bg-surface-1 p-3">
        <p className="font-semibold text-ink-900">
          Palier {plan.data.name} · {stations} station{stations > 1 ? "s" : ""} active{stations > 1 ? "s" : ""}
        </p>
        <p className="mt-1 text-ink-800">{priceLine(network.data)}</p>
      </div>
      <ExportButtons />
    </div>
  );
}
