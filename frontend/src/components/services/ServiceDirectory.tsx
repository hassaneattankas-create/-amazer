"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { preconnect } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Fuel, LocateFixed, Pill, Share2 } from "lucide-react";

import { LocalServiceCard } from "@/components/services/LocalServiceCard";
import { OfficialLists } from "@/components/services/OfficialLists";
import { PharmacyDutyBoard } from "@/components/services/PharmacyDutyBoard";
import type { MapLevel, MapPoint } from "@/components/services/ServicesMap";
import { Button } from "@/components/ui/button";
import { NIGER_REGION_CITIES, distanceKm, type GeoPoint } from "@/lib/local-services";
import { getPharmacyDirectory, getPharmacyDuty, listOfficialLists, listPharmacies, listStations } from "@/services/local-services-service";
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

// Carte en haut de page, chargée côté client seulement (Leaflet).
const ServicesMap = dynamic(() => import("@/components/services/ServicesMap").then((m) => m.ServicesMap), {
  ssr: false,
  loading: () => <div className="aspect-[4/3] w-full animate-pulse rounded-card border border-border bg-surface-1 sm:aspect-video" aria-busy="true" />,
});

/** Établissement ou quartier de Niamey tiré d'OpenStreetMap (fichiers de public/data). */
type OsmPlace = {
  n: string;
  b?: string;
  lat: number;
  lng: number;
  /** Annuaire des pharmacies : numéro (format tel), repère, position approximative (quartier). */
  phone?: string | null;
  where?: string;
  approximate?: boolean;
  area?: string | null;
};

/** Nom sans accents ni « Pharmacie » : « Pharmacie le Gorouol » → « le gorouol ». */
const bareName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(pharmacie|phamacie|pharamcie)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Niamey : cadrage par défaut sur « Tout le Niger » (la plupart des établissements y sont). */
const NIAMEY_CENTER: GeoPoint = { lat: 13.5116, lng: 2.1254 };

const PHARMACY_LEGEND: { level: MapLevel; label: string }[] = [
  { level: "available", label: "De garde" },
  { level: "unknown", label: "Inscrite, pas de garde (horaires habituels)" },
];

type StationFilter = "all" | "available" | "duty";

const pillClass = (active: boolean) =>
  `inline-flex min-h-11 shrink-0 items-center gap-2 rounded-pill border px-4 text-sm font-medium transition-colors duration-fast ${
    active ? "border-ink-900 bg-ink-900 text-white" : "border-border bg-card text-ink-700 hover:border-ink-400"
  }`;

export function ServiceDirectory({ kind }: { kind: ServiceKind }) {
  // La carte (en haut) affiche des tuiles OpenStreetMap : connexion ouverte dès l'arrivée de la page.
  preconnect("https://tile.openstreetmap.org");
  const copy = COPY[kind];
  const Icon = kind === "pharmacy" ? Pill : Fuel;
  const [city, setCity] = useState("");
  // Stations : toutes par défaut. Pharmacies : les gardes de la semaine sont dans le bloc officiel au-dessus,
  // la liste du bas montre toutes les pharmacies inscrites.
  const [onlyActive, setOnlyActive] = useState(false);
  const [fuel, setFuel] = useState<FuelKey | "">("");
  const [position, setPosition] = useState<GeoPoint | null>(null);
  const [locating, setLocating] = useState(false);
  // Stations : seulement celles de garde (exclusif avec « Disponible maintenant »).
  const [dutyOnly, setDutyOnly] = useState(false);
  const stations = kind === "fuel_station";

  const { data, isPending, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["local-services", kind, city, onlyActive, fuel, dutyOnly],
    queryFn: () =>
      kind === "pharmacy"
        ? listPharmacies({ city: city || undefined, onDuty: onlyActive })
        : listStations({ city: city || undefined, fuel: fuel || undefined, available: onlyActive, onDuty: dutyOnly }),
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
  // Listes officielles en cours (même requête que le bloc officiel, mise en cache) : adoucit le « rien trouvé ».
  const officialKind = kind === "pharmacy" ? "pharmacy_duty" : "fuel_supply";
  const { data: official = [] } = useQuery({
    queryKey: ["official-lists", officialKind, city],
    queryFn: () => listOfficialLists(officialKind, city || undefined),
    staleTime: 60_000,
  });
  const hasOfficial = official.length > 0;
  // Pharmacies de garde de la semaine (même requête et même cache que le tableau de garde) : placées sur la carte.
  const dutyCity = city || "Niamey";
  const { data: duty } = useQuery({
    queryKey: ["pharmacy-duty", dutyCity],
    queryFn: () => getPharmacyDuty(dutyCity),
    staleTime: 60_000,
    refetchInterval: 600_000,
    enabled: kind === "pharmacy",
  });

  // Toutes les stations-service (OpenStreetMap) et toutes les pharmacies (annuaire AMAZER : position et numéro
  // gardés, de garde ou non) en petits points gris : la carte n'est jamais vide et on peut chercher n'importe laquelle.
  const inNiamey = !city || city.toLowerCase() === "niamey";
  // Stations : seulement sur « Toutes », sans filtre de carburant (une station inconnue n'est pas « disponible »).
  const showOsm = stations ? inNiamey && !onlyActive && !dutyOnly && !fuel : true;
  const { data: osmPlaces } = useQuery({
    queryKey: ["osm-niamey", kind, dutyCity],
    queryFn: async (): Promise<OsmPlace[]> => {
      if (!stations) {
        const listings = await getPharmacyDirectory(dutyCity);
        return listings
          .filter((p) => p.latitude != null && p.longitude != null)
          .map((p) => ({
            n: p.name,
            lat: p.latitude as number,
            lng: p.longitude as number,
            phone: p.phone_link,
            where: [p.location, p.district].filter(Boolean).join(" · "),
            approximate: p.approximate,
            area: p.area,
          }));
      }
      const response = await fetch("/data/niamey-stations-osm.json");
      if (!response.ok) return [];
      const body = (await response.json()) as { stations: OsmPlace[] };
      return body.stations;
    },
    staleTime: stations ? Infinity : 5 * 60_000,
    enabled: showOsm,
  });
  const { data: quartiers = [] } = useQuery({
    queryKey: ["niamey-quartiers"],
    queryFn: async () => {
      const response = await fetch("/data/niamey-quartiers.json");
      if (!response.ok) return [];
      const body = (await response.json()) as { quartiers: OsmPlace[] };
      return body.quartiers.map((q) => ({ name: q.n, lat: q.lat, lng: q.lng }));
    },
    staleTime: Infinity,
    enabled: inNiamey,
  });

  const dutyWeek = duty?.current?.items;
  const dutyDeclared = duty?.declared;

  // Carte : listes officielles (affiche de garde, communiqué des stations) + établissements inscrits, sans doublon.
  const map = useMemo(() => {
    const points: MapPoint[] = [];
    let unplaced = 0;
    const listed = new Set<string>();
    if (kind === "pharmacy") {
      for (const item of [...(dutyWeek ?? []), ...(dutyDeclared ?? [])]) {
        if (item.vendor_id) listed.add(item.vendor_id);
        if (item.latitude == null || item.longitude == null) {
          unplaced += 1;
          continue;
        }
        points.push({
          id: `duty:${item.vendor_id ?? item.name}`,
          name: `Pharmacie ${item.name}`,
          latitude: item.latitude,
          longitude: item.longitude,
          level: "available",
          approximate: Boolean(item.approximate),
          area: item.area ?? null,
          lines: [`De garde ${item.until_label}`, [item.location, item.commune].filter(Boolean).join(" · ")].filter(Boolean),
          phone: item.phone_link ? `tel:${item.phone_link}` : null,
          mapsUrl: item.maps_url,
        });
      }
    } else {
      for (const list of official) {
        if (fuel && list.fuel && list.fuel !== fuel) continue;
        for (const entry of list.entries) {
          if (entry.latitude == null || entry.longitude == null) {
            unplaced += 1;
            continue;
          }
          const brand = list.brand ? `${list.brand} ` : "";
          points.push({
            id: `${list.id}:${entry.name}`,
            name: `Station ${brand}${entry.name}`,
            latitude: entry.latitude,
            longitude: entry.longitude,
            level: "available",
            approximate: Boolean(entry.approximate),
            area: entry.area ?? null,
            lines: [`Approvisionnée${list.fuel ? ` en ${FUEL_LABELS[list.fuel].toLowerCase()}` : ""} selon le communiqué`, entry.location ?? ""].filter(Boolean),
            phone: list.contact_phone ? `tel:${list.contact_phone.replace(/[^+0-9]/g, "")}` : null,
            mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Station ${brand}${entry.name}, ${list.city}, Niger`)}`,
          });
        }
      }
    }
    const registered = items.map(({ item }) => item).filter((item) => !listed.has(item.vendor_id));
    if (showOsm && osmPlaces?.length) {
      // Pas de point gris là où un établissement inscrit (ou de la liste officielle) est déjà placé (~100 m),
      // ni pour une pharmacie de garde de la liste (même nom écrit autrement, placée au quartier).
      const taken = [
        ...registered.filter((item) => item.latitude != null && item.longitude != null).map((item) => [item.latitude as number, item.longitude as number]),
        ...points.map((point) => [point.latitude, point.longitude]),
      ];
      const dutyNames = stations ? [] : (dutyWeek ?? []).map((item) => bareName(item.name)).filter((name) => name.length >= 4);
      const onDutyList = !stations && Boolean(dutyWeek?.length);
      for (const place of osmPlaces) {
        if (taken.some(([lat, lng]) => Math.abs(lat - place.lat) < 0.001 && Math.abs(lng - place.lng) < 0.001)) continue;
        const bare = bareName(place.n);
        if (dutyNames.some((name) => bare.includes(name) || (bare.length >= 4 && name.includes(bare)))) continue;
        points.push({
          id: `osm:${place.lat},${place.lng}`,
          name: stations ? (place.b ? `${place.n} (${place.b})` : place.n) : /^pharmacie/i.test(place.n) ? place.n : `Pharmacie ${place.n}`,
          latitude: place.lat,
          longitude: place.lng,
          level: "unknown",
          approximate: Boolean(place.approximate),
          area: place.area ?? null,
          lines: [
            stations
              ? "Pas encore sur AMAZER : disponibilités inconnues, appelez ou passez voir."
              : onDutyList
                ? "Pas de garde cette semaine d'après la liste officielle : horaires habituels."
                : "Horaires habituels : appelez avant de vous déplacer.",
            place.where ?? "",
          ].filter(Boolean),
          phone: place.phone ? `tel:${place.phone}` : null,
          mapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`,
          variant: "dot",
        });
      }
    }
    return { points, unplaced, registered };
  }, [kind, stations, dutyWeek, dutyDeclared, official, fuel, items, showOsm, osmPlaces]);

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

  const stationFilter: StationFilter = dutyOnly ? "duty" : onlyActive ? "available" : "all";
  const setStationFilter = (next: StationFilter) => {
    setOnlyActive(next === "available");
    setDutyOnly(next === "duty");
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

      {/* La carte d'abord : on voit tout de suite où aller (« Près de moi » la centre sur le client). */}
      <section aria-labelledby={`${kind}-map-title`} className="mt-4">
        <h2 id={`${kind}-map-title`} className="sr-only">
          {kind === "pharmacy" ? "Carte des pharmacies de garde" : "Carte des stations"}
        </h2>
        <ServicesMap
          kind={kind}
          items={map.registered}
          fuel={fuel}
          position={position}
          points={map.points}
          unplaced={map.unplaced}
          legend={kind === "pharmacy" ? PHARMACY_LEGEND : undefined}
          home={city ? null : NIAMEY_CENTER}
          places={quartiers}
        />
      </section>

      {kind === "pharmacy" ? (
        <>
          <PharmacyDutyBoard city={city} position={position} />
          <h2 className="mt-10 text-lg font-semibold text-ink-900">Pharmacies inscrites sur AMAZER</h2>
          <p className="mt-1 text-sm text-ink-600">Leur vitrine, leur position exacte et leurs gardes déclarées.</p>
        </>
      ) : null}

      <div className="-mx-gutter mt-4 overflow-x-auto px-gutter">
        <div className="flex gap-2" role="group" aria-label="Filtres">
          {/* Stations : Toutes / Disponible maintenant / De garde ; pharmacies : « De garde » d'abord. */}
          {stations
            ? (
                // Libellés courts : les trois boutons tiennent sur un téléphone de 360 px.
                [
                  ["all", "Toutes"],
                  ["available", "Disponibles"],
                  ["duty", "De garde"],
                ] as const
              ).map(([key, label]) => (
                <button key={key} type="button" aria-pressed={stationFilter === key} onClick={() => setStationFilter(key)} className={pillClass(stationFilter === key)}>
                  {label}
                </button>
              ))
            : [true, false].map((only) => (
                <button key={String(only)} type="button" aria-pressed={onlyActive === only} onClick={() => setOnlyActive(only)} className={pillClass(onlyActive === only)}>
                  {only ? copy.onlyLabel : copy.allLabel}
                </button>
              ))}
        </div>
      </div>
      {kind === "fuel_station" ? (
        <div className="-mx-gutter mt-2 overflow-x-auto px-gutter">
          {/* Sous-choix : le carburant précise la liste choisie au-dessus. */}
          <div className="ml-2 flex items-center gap-2 border-l-2 border-border pl-3" role="group" aria-label="Carburant">
            <span className="shrink-0 text-xs font-medium text-ink-600">Carburant :</span>
            {(["", "super", "gasoil", "gaz"] as const).map((key) => (
              <button
                key={key || "all"}
                type="button"
                aria-pressed={fuel === key}
                onClick={() => setFuel(key)}
                className={`inline-flex min-h-10 shrink-0 items-center rounded-pill border px-3 text-xs font-medium transition-colors duration-fast ${
                  fuel === key ? "border-brand-600 bg-brand-50 text-brand-700" : "border-border bg-card text-ink-700 hover:border-ink-400"
                }`}
              >
                {key ? FUEL_LABELS[key] : "Tous"}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-xs text-ink-600">
        {kind === "pharmacy"
          ? "Appelez avant de vous déplacer. AMAZER ne vend pas de médicaments."
          : "Informations données par les stations, avec la date de leur dernière mise à jour."}
        {refreshedAt ? ` Actualisé à ${refreshedAt}.` : null}
        {deliveryCities.length ? ` Livraison AMAZER : ${deliveryCities.join(", ")}.` : null}
      </p>

      {stations ? <OfficialLists kind={kind} city={city} fuel={fuel} /> : null}

      {hasOfficial && stations ? (
        <h2 className="mt-6 text-lg font-semibold text-ink-900">Stations inscrites sur AMAZER</h2>
      ) : null}

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
              <LocalServiceCard key={item.outlet_id ?? item.vendor_id} item={item} kind={kind} distanceKm={distance} />
            ))}
          </div>
        ) : hasOfficial ? (
          <p className="text-sm text-ink-600">
            {kind === "pharmacy"
              ? "Aucune pharmacie inscrite ici pour le moment : consultez la liste officielle ci-dessus."
              : "Aucune station inscrite n'a signalé de disponibilité ici : consultez la liste ci-dessus."}
          </p>
        ) : (
          <div className="rounded-card border border-border bg-card p-6 text-center">
            <p className="font-semibold text-ink-900">{dutyOnly ? "Aucune station de garde signalée ici pour le moment" : copy.empty}</p>
            <p className="mt-1 text-sm text-ink-600">{copy.emptyHint}</p>
            {onlyActive || dutyOnly ? (
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                onClick={() => {
                  setOnlyActive(false);
                  setDutyOnly(false);
                }}
              >
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
