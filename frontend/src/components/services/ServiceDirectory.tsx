"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Fuel, LocateFixed, Pill, Share2 } from "lucide-react";

import { LocalServiceCard } from "@/components/services/LocalServiceCard";
import { Button } from "@/components/ui/button";
import { NIGER_REGION_CITIES, distanceKm, type GeoPoint } from "@/lib/local-services";
import { listPharmacies, listStations } from "@/services/local-services-service";
import { toast } from "@/store/toast-store";
import { FUEL_LABELS, type FuelKey, type ServiceKind } from "@/types/local-services";

const COPY: Record<ServiceKind, { title: string; subtitle: string; onlyLabel: string; allLabel: string; empty: string; emptyHint: string; joinTitle: string; joinText: string; share: string; path: string }> = {
  pharmacy: {
    title: "Pharmacies de garde",
    subtitle: "Trouvez une pharmacie ouverte maintenant, partout au Niger.",
    onlyLabel: "De garde maintenant",
    allLabel: "Toutes les pharmacies",
    empty: "Aucune pharmacie de garde trouvée ici pour le moment",
    emptyHint: "Affichez toutes les pharmacies ou choisissez une autre ville.",
    joinTitle: "Vous êtes pharmacien ?",
    joinText: "Indiquez vos gardes en un geste : les clients vous trouvent la nuit et le week-end.",
    share: "Pharmacies de garde en ce moment",
    path: "/pharmacies",
  },
  fuel_station: {
    title: "Où trouver de l'essence",
    subtitle: "Super, gasoil et gaz : les stations qui en ont, mises à jour par les stations elles-mêmes.",
    onlyLabel: "Disponible maintenant",
    allLabel: "Toutes les stations",
    empty: "Aucune station n'a signalé de disponibilité récente ici",
    emptyHint: "Affichez toutes les stations ou choisissez une autre ville, puis appelez pour confirmer.",
    joinTitle: "Vous gérez une station ?",
    joinText: "Signalez vos disponibilités en un geste : les clients viennent chez vous au lieu de chercher.",
    share: "Stations avec du carburant en ce moment",
    path: "/stations",
  },
};

const pillClass = (active: boolean) =>
  `inline-flex min-h-11 shrink-0 items-center gap-2 rounded-pill border px-4 text-sm font-medium transition-colors duration-fast ${
    active ? "border-ink-900 bg-ink-900 text-white" : "border-border bg-card text-ink-700 hover:border-ink-400"
  }`;

export function ServiceDirectory({ kind }: { kind: ServiceKind }) {
  const copy = COPY[kind];
  const Icon = kind === "pharmacy" ? Pill : Fuel;
  const [city, setCity] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);
  const [fuel, setFuel] = useState<FuelKey | "">("");
  const [position, setPosition] = useState<GeoPoint | null>(null);
  const [locating, setLocating] = useState(false);

  const { data, isPending, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["local-services", kind, city, onlyActive, fuel],
    queryFn: () =>
      kind === "pharmacy"
        ? listPharmacies({ city: city || undefined, onDuty: onlyActive })
        : listStations({ city: city || undefined, fuel: fuel || undefined, available: onlyActive }),
    // Une disponibilité change vite pendant une pénurie : rafraîchi toutes les minutes.
    refetchInterval: kind === "fuel_station" ? 60_000 : 300_000,
  });

  const items = useMemo(() => {
    const rows = (data?.items ?? []).map((item) => ({
      item,
      distance: position && item.latitude != null && item.longitude != null ? distanceKm(position, { lat: item.latitude, lng: item.longitude }) : null,
    }));
    // « Près de moi » : les plus proches d'abord, sans changer l'ordre de priorité du serveur pour le reste.
    return position ? [...rows].sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)) : rows;
  }, [data, position]);

  // Toutes les régions, puis les autres villes où des établissements sont inscrits.
  const cities = useMemo(() => {
    const known = new Set(NIGER_REGION_CITIES.map((name) => name.toLowerCase()));
    const extra = (data?.cities ?? []).map((c) => c.city).filter((name) => !known.has(name.toLowerCase()));
    if (city && !known.has(city.toLowerCase()) && !extra.includes(city)) extra.push(city);
    return [...NIGER_REGION_CITIES, ...extra.sort((a, b) => a.localeCompare(b, "fr"))];
  }, [data, city]);
  const deliveryCities = data?.delivery_cities ?? [];

  const locate = () => {
    if (!("geolocation" in navigator)) {
      toast.error("La localisation n'est pas disponible sur cet appareil.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.error("Position introuvable. Autorisez la localisation pour AMAZER, puis réessayez.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 }
    );
  };

  const share = async () => {
    const url = `https://amazer.store${copy.path}`;
    const text = `${copy.share}${city ? ` à ${city}` : ""} sur AMAZER : ${url}`;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: copy.title, text, url });
        return;
      } catch {
        // Partage annulé : on propose WhatsApp ci-dessous.
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const refreshedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <section className="mx-auto w-full max-w-7xl px-gutter pb-14 pt-4">
      <header className="rounded-card bg-ink-900 px-4 py-6 text-white sm:px-8 sm:py-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-display-sm font-semibold tracking-display">
              <Icon className="h-7 w-7 text-brand-400" aria-hidden="true" />
              {copy.title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-white/80">{copy.subtitle}</p>
          </div>
          <Button type="button" variant="outline" onClick={() => void share()} className="shrink-0 border-white/30 bg-transparent text-white hover:bg-white/10" aria-label="Partager la liste">
            <Share2 className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Partager</span>
          </Button>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label htmlFor={`${kind}-city`} className="sr-only">
            Ville
          </label>
          <select
            id={`${kind}-city`}
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="h-12 w-full rounded-pill bg-card px-4 text-base text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:max-w-xs"
          >
            <option value="">Tout le Niger</option>
            {cities.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            onClick={locate}
            disabled={locating}
            className="h-12 rounded-pill bg-brand-600 px-5 text-base text-white hover:bg-brand-700"
          >
            <LocateFixed className="h-5 w-5" aria-hidden="true" />
            {locating ? "Localisation…" : position ? "Trié par distance" : "Près de moi"}
          </Button>
        </div>
      </header>

      <div className="-mx-gutter mt-4 overflow-x-auto px-gutter">
        <div className="flex gap-2" role="group" aria-label="Filtres">
          <button type="button" aria-pressed={onlyActive} onClick={() => setOnlyActive(true)} className={pillClass(onlyActive)}>
            {copy.onlyLabel}
          </button>
          <button type="button" aria-pressed={!onlyActive} onClick={() => setOnlyActive(false)} className={pillClass(!onlyActive)}>
            {copy.allLabel}
          </button>
          {kind === "fuel_station"
            ? (["", "super", "gasoil", "gaz"] as const).map((key) => (
                <button key={key || "all"} type="button" aria-pressed={fuel === key} onClick={() => setFuel(key)} className={pillClass(fuel === key)}>
                  {key ? FUEL_LABELS[key] : "Tous carburants"}
                </button>
              ))
            : null}
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-600">
        {kind === "pharmacy"
          ? "Appelez avant de vous déplacer. AMAZER ne vend pas de médicaments."
          : `Informations données par les stations. Au-delà de ${data?.fresh_hours ?? 6} h, appelez pour confirmer.`}
        {refreshedAt ? ` Actualisé à ${refreshedAt}.` : null}
        {deliveryCities.length ? ` Livraison AMAZER : ${deliveryCities.join(", ")}.` : null}
      </p>

      <div className="mt-4">
        {isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-64 animate-pulse rounded-card border border-border bg-surface-1" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-card border border-border bg-card p-6 text-center">
            <p className="text-sm text-ink-700">Impossible de charger la liste. Vérifiez votre connexion.</p>
            <Button type="button" variant="outline" className="mt-3" onClick={() => void refetch()}>
              Réessayer
            </Button>
          </div>
        ) : items.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(({ item, distance }) => (
              <LocalServiceCard key={item.outlet_id ?? item.vendor_id} item={item} kind={kind} distanceKm={distance} freshHours={data?.fresh_hours ?? 6} />
            ))}
          </div>
        ) : (
          <div className="rounded-card border border-border bg-card p-6 text-center">
            <p className="font-semibold text-ink-900">{copy.empty}</p>
            <p className="mt-1 text-sm text-ink-600">{copy.emptyHint}</p>
            {onlyActive ? (
              <Button type="button" variant="outline" className="mt-3" onClick={() => setOnlyActive(false)}>
                {copy.allLabel}
              </Button>
            ) : null}
          </div>
        )}
      </div>

      <aside className="mt-10 flex flex-col items-start gap-3 rounded-card border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-ink-900">{copy.joinTitle}</p>
          <p className="text-sm text-ink-600">{copy.joinText}</p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/vendre">Rejoindre AMAZER</Link>
        </Button>
      </aside>
    </section>
  );
}
