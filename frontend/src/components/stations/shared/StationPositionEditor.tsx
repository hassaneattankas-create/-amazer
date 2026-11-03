"use client";

import { useId, useState } from "react";
import { ExternalLink, Link2, LocateFixed, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/store/toast-store";
import type { StationInfoUpdate } from "@/types/station-space";

import { stationFieldClass, stationLabelClass, type StationSaveFn } from "./station-ui";

/** Au-delà, le point GPS est trop imprécis pour guider un client jusqu'à la pompe. */
const MAX_ACCURACY_M = 150;

export type StationPositionPatch = Pick<StationInfoUpdate, "latitude" | "longitude" | "maps_link">;

export type StationPositionEditorProps = {
  latitude: number | null;
  longitude: number | null;
  /** Lien Google Maps de la station (position exacte, sinon recherche de l'adresse). */
  mapsUrl: string;
  busy?: boolean;
  disabled?: boolean;
  /** Reçoit { latitude, longitude } (GPS) ou { maps_link } (lien ou coordonnées collés). */
  onSave: StationSaveFn<StationPositionPatch>;
};

/** Position Google Maps : GPS sur place (haute précision) ou lien/coordonnées collés, et lien « Voir sur Google Maps ». */
export function StationPositionEditor({ latitude, longitude, mapsUrl, busy = false, disabled = false, onSave }: StationPositionEditorProps) {
  const uid = useId();
  const [locating, setLocating] = useState(false);
  const [link, setLink] = useState("");
  const locked = busy || disabled;
  const hasPosition = latitude != null && longitude != null;

  const locate = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      toast.error("La localisation n'est pas disponible sur cet appareil.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const accuracy = Math.round(pos.coords.accuracy);
        if (accuracy > MAX_ACCURACY_M) {
          toast.error(`Signal GPS imprécis (± ${accuracy} m). Sortez à découvert près des pompes, puis réessayez.`);
          return;
        }
        void onSave({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }).catch(() => undefined);
      },
      () => {
        setLocating(false);
        toast.error("Position introuvable. Autorisez la localisation pour AMAZER, puis réessayez depuis la station.");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-800">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
          {hasPosition ? "Position enregistrée." : "Pas encore de position : l'itinéraire cherche l'adresse."}
        </span>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1 font-semibold text-brand-700 hover:underline"
        >
          Voir sur Google Maps
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </p>

      <Button type="button" className="h-auto min-h-11 w-full whitespace-normal py-2 sm:w-auto" disabled={locked || locating} onClick={locate}>
        <LocateFixed className="h-4 w-4" aria-hidden="true" />
        {locating ? "Localisation…" : "Je suis à la station : enregistrer la position"}
      </Button>

      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const value = link.trim();
          if (!value) {
            toast.error("Collez un lien Google Maps ou des coordonnées (ex. 13.5137, 2.1098).");
            return;
          }
          void onSave({ maps_link: value })
            .then(() => setLink(""))
            .catch(() => undefined);
        }}
      >
        <label className={stationLabelClass} htmlFor={`${uid}-link`}>
          Ou collez un lien Google Maps / des coordonnées
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={`${uid}-link`}
            className={cn(stationFieldClass, "mt-0 sm:flex-1")}
            value={link}
            maxLength={500}
            disabled={locked}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://www.google.com/maps/… ou 13.5137, 2.1098"
            aria-describedby={`${uid}-howto`}
          />
          <Button type="submit" variant="outline" className="min-h-11" disabled={locked}>
            <Link2 className="h-4 w-4" aria-hidden="true" />
            {busy ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
        <p id={`${uid}-howto`} className="text-xs text-ink-600">
          Dans Google Maps, appuyez longuement sur la station puis copiez les coordonnées affichées. Le GPS sur place reste le plus précis.
        </p>
      </form>
    </div>
  );
}
