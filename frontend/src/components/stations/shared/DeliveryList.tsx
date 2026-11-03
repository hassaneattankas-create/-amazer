"use client";

import { useState } from "react";
import { Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import { timeAgo } from "@/lib/local-services";
import type { DeliveryItem } from "@/types/station-space";

import { StationDataState } from "./StationDataState";
import { FUEL_LABELS, formatDateTime, formatLiters } from "./station-ui";

export type DeliveryListProps = {
  items: DeliveryItem[] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** Afficher le nom de la station (vue ville ou marque). */
  showOutlet?: boolean;
  emptyText?: string;
  /** Lignes affichées avant « Voir plus ». */
  pageSize?: number;
};

/** Livraisons des 30 derniers jours : carburant, quantité, bon, date, auteur. */
export function DeliveryList({
  items,
  isLoading,
  isError,
  onRetry,
  showOutlet = false,
  emptyText = "Aucune livraison enregistrée ces 30 derniers jours.",
  pageSize = 20,
}: DeliveryListProps) {
  const now = useNow();
  const [visible, setVisible] = useState(pageSize);
  return (
    <StationDataState
      items={items}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      emptyText={emptyText}
      errorText="Livraisons indisponibles pour le moment."
    >
      {(rows) => (
        <div className="space-y-2">
          <ul className="divide-y divide-border rounded-field border border-border text-sm">
            {rows.slice(0, visible).map((delivery) => (
              <li key={delivery.id} className="flex items-start gap-3 px-3 py-2">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-ink-500" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-900">
                    {FUEL_LABELS[delivery.fuel]} · {formatLiters(delivery.liters)}
                    {showOutlet ? <span className="font-normal text-ink-700"> · {delivery.outlet_name}</span> : null}
                  </p>
                  <p className="text-xs text-ink-600">
                    <time dateTime={delivery.delivered_at} title={formatDateTime(delivery.delivered_at)}>
                      {timeAgo(delivery.delivered_at, now)}
                    </time>
                    {delivery.reference ? ` · bon ${delivery.reference}` : ""}
                    {delivery.recorded_by ? ` · par ${delivery.recorded_by}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {rows.length > visible ? (
            <Button type="button" variant="outline" size="sm" className="min-h-11 w-full" onClick={() => setVisible((n) => n + pageSize)}>
              Voir plus ({rows.length - visible})
            </Button>
          ) : null}
        </div>
      )}
    </StationDataState>
  );
}
