"use client";

import { useState } from "react";
import { Check, LocateFixed, X } from "lucide-react";

import { toast } from "@/store/toast-store";

export type DeliveryPosition = { latitude: number; longitude: number; accuracy: number | null };

/** Même zone que le serveur (Niger avec une marge) : une position d'ailleurs ne sert pas au livreur. */
const inNiger = (lat: number, lng: number) => lat >= 10 && lat <= 24.5 && lng >= -0.5 && lng <= 16.5;

/**
 * « Utiliser ma position » : la position GPS exacte du lieu de livraison, en plus de l'adresse et du repère.
 * Le livreur reçoit l'itinéraire direct (à Niamey, les adresses se décrivent par des repères).
 */
export function DeliveryPositionButton({ value, onChange }: { value: DeliveryPosition | null; onChange: (value: DeliveryPosition | null) => void }) {
  const [locating, setLocating] = useState(false);

  const locate = () => {
    if (!("geolocation" in navigator)) {
      toast.error("La localisation n'est pas disponible sur cet appareil : écrivez l'adresse et un repère.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude, accuracy } = pos.coords;
        if (!inNiger(latitude, longitude)) {
          toast.error("Vous n'êtes pas au Niger : laissez seulement l'adresse et le repère du lieu de livraison.");
          return;
        }
        onChange({ latitude, longitude, accuracy: Number.isFinite(accuracy) ? Math.round(accuracy) : null });
      },
      () => {
        setLocating(false);
        toast.error("Position introuvable. Autorisez la localisation pour AMAZER, ou écrivez l'adresse et un repère.");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
    );
  };

  if (value) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-field bg-success/10 px-3 py-2 text-sm text-ink-800">
        <Check className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          Position enregistrée{value.accuracy ? ` (à ${value.accuracy} m près)` : ""} : le livreur aura l&apos;itinéraire exact.
        </span>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${value.latitude},${value.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-700 hover:underline"
        >
          Voir
        </a>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Retirer la position"
          className="inline-flex h-9 w-9 items-center justify-center rounded-pill text-ink-600 hover:bg-card"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={locate}
        disabled={locating}
        className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-border bg-card px-4 text-sm font-semibold text-ink-900 hover:bg-surface-1 disabled:opacity-60"
      >
        <LocateFixed className="h-4 w-4 text-brand-600" aria-hidden="true" />
        {locating ? "Localisation…" : "Utiliser ma position"}
      </button>
      <p className="text-xs text-ink-600">Sur le lieu de livraison : le livreur arrive directement, sans chercher.</p>
    </div>
  );
}
