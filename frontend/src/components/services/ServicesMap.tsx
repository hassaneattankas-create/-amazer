"use client";

// Carte des stations et des pharmacies (Leaflet + fond OpenStreetMap, sans clé), en haut de la page.
// Chargée côté client seulement (next/dynamic, ssr: false) depuis ServiceDirectory.
import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search, X } from "lucide-react";

import type { GeoPoint } from "@/lib/local-services";
import { FUEL_LABELS, FUEL_STATE_LABELS, type FuelKey, type FuelState, type LocalServiceItem, type ServiceKind } from "@/types/local-services";

export type MapLevel = FuelState | "unknown";
type Level = MapLevel;

/** Point d'une liste officielle (pharmacie de garde de l'affiche, station approvisionnée du communiqué). */
export type MapPoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  level: MapLevel;
  /** Centre du quartier : la position exacte n'est pas connue. */
  approximate: boolean;
  area: string | null;
  lines: string[];
  phone: string | null;
  mapsUrl: string;
  /** Petit point gris : établissement connu d'OpenStreetMap mais pas (encore) inscrit sur AMAZER. */
  variant?: "dot";
};

/** Niamey : centre par défaut quand ni la position du client ni aucune station ne sont connues. */
const NIAMEY: L.LatLngExpression = [13.5116, 2.1254];
const FUELS: FuelKey[] = ["super", "gasoil", "gaz"];

// Classes écrites en entier : Tailwind doit les voir telles quelles dans le code.
const LEVEL_CLASS: Record<Level, string> = {
  available: "bg-success",
  low: "bg-warning",
  out: "bg-danger",
  unknown: "bg-ink-400",
};

const LEGEND: Record<ServiceKind, { level: Level; label: string }[]> = {
  fuel_station: [
    { level: "available", label: "Disponible" },
    { level: "low", label: "Stock faible" },
    { level: "out", label: "Rupture" },
    { level: "unknown", label: "Non confirmé" },
  ],
  pharmacy: [
    { level: "available", label: "De garde" },
    { level: "unknown", label: "Pas de garde (horaires habituels)" },
  ],
};

type Placed = LocalServiceItem & { latitude: number; longitude: number };
const isPlaced = (item: LocalServiceItem): item is Placed => item.latitude != null && item.longitude != null;

/** Pharmacie : verte si de garde. Station : ce qu'elle a de mieux pour le carburant choisi (ou n'importe lequel). */
function itemLevel(kind: ServiceKind, item: LocalServiceItem, fuel: FuelKey | ""): Level {
  if (kind === "pharmacy") return item.on_duty ? "available" : "unknown";
  if (!item.fuel_fresh) return "unknown";
  const states = (fuel ? [item.fuel[fuel]] : FUELS.map((key) => item.fuel[key])).filter((s): s is FuelState => Boolean(s));
  if (states.includes("available")) return "available";
  if (states.includes("low")) return "low";
  return states.includes("out") ? "out" : "unknown";
}

const DOT_ICON = L.divIcon({
  className: "",
  html: '<span class="block h-3 w-3 rounded-full border-2 border-white bg-ink-400 shadow-raised"></span>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -6],
});

function markerIcon(level: Level, onDuty: boolean, approximate = false): L.DivIcon {
  const ring = onDuty ? " ring-2 ring-ink-900 ring-offset-1" : "";
  if (approximate) {
    // Position approximative : pastille plus petite, cerclée de pointillés.
    return L.divIcon({
      className: "",
      html: `<span class="block h-5 w-5 rounded-full border-2 border-dashed border-ink-900 p-0.5 shadow-raised"><span class="block h-full w-full rounded-full ${LEVEL_CLASS[level]}"></span></span>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -10],
    });
  }
  return L.divIcon({
    className: "",
    html: `<span class="block h-6 w-6 rounded-full border-2 border-white shadow-raised ${LEVEL_CLASS[level]}${ring}"></span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

/** Bulles assez étroites pour un téléphone de 360 px (la carte fait ~330 px de large). */
const POPUP: L.PopupOptions = { maxWidth: 240, autoPanPaddingTopLeft: [48, 16], autoPanPaddingBottomRight: [16, 16] };

const ME_ICON = L.divIcon({
  className: "",
  html: '<span class="block h-4 w-4 rounded-full border-2 border-white bg-info shadow-raised"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/** Bulle d'un établissement, construite en DOM (textContent) : aucun nom n'est interprété comme du HTML. */
function popupContent(kind: ServiceKind, item: LocalServiceItem): HTMLElement {
  const box = document.createElement("div");
  box.className = "space-y-1 text-sm";
  const add = (tag: string, text: string, className: string) => {
    const el = document.createElement(tag);
    el.className = className;
    el.textContent = text;
    box.appendChild(el);
    return el;
  };
  add("p", item.business_name, "font-semibold text-ink-900");
  if (item.duty_label) add("p", item.duty_label, "font-semibold text-ink-900");
  if (kind === "pharmacy") {
    if (!item.on_duty) add("p", "Pas de garde en ce moment : horaires habituels.", "text-ink-700");
    if (item.address) add("p", item.address, "text-ink-600");
  } else {
    const fuels = FUELS.flatMap((key) => {
      const state = item.fuel[key];
      return state ? [`${FUEL_LABELS[key]} : ${FUEL_STATE_LABELS[state]}`] : [];
    });
    add("p", item.fuel_fresh && fuels.length ? fuels.join(" · ") : "Disponibilités non confirmées : appelez avant d'y aller.", "text-ink-700");
  }
  if (item.opening_hours) add("p", `Horaires : ${item.opening_hours}`, "text-ink-600");
  const actions = document.createElement("p");
  actions.className = "flex gap-3 pt-1";
  const link = (href: string, text: string, external: boolean) => {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = text;
    a.className = "font-semibold text-brand-700 underline";
    if (external) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
    actions.appendChild(a);
  };
  link(item.maps_url, "Itinéraire", true);
  if (item.phone) link(`tel:${item.phone.replace(/[^+0-9]/g, "")}`, "Appeler", false);
  box.appendChild(actions);
  return box;
}

/** Bulle d'un point de liste officielle (même construction DOM que ci-dessus). */
function pointContent(point: MapPoint): HTMLElement {
  const box = document.createElement("div");
  box.className = "space-y-1 text-sm";
  const add = (text: string, className: string) => {
    const el = document.createElement("p");
    el.className = className;
    el.textContent = text;
    box.appendChild(el);
  };
  add(point.name, "font-semibold text-ink-900");
  for (const line of point.lines) add(line, "text-ink-700");
  if (point.approximate) add(`Position approximative${point.area ? ` (quartier ${point.area})` : ""} : appelez avant de vous déplacer.`, "text-ink-600");
  const actions = document.createElement("p");
  actions.className = "flex gap-3 pt-1";
  const link = (href: string, text: string, external: boolean) => {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = text;
    a.className = "font-semibold text-brand-700 underline";
    if (external) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
    actions.appendChild(a);
  };
  if (point.phone) link(point.phone, "Appeler", false);
  link(point.mapsUrl, "Itinéraire", true);
  box.appendChild(actions);
  return box;
}

export type ServicesMapProps = {
  kind: ServiceKind;
  items: LocalServiceItem[];
  fuel: FuelKey | "";
  position: GeoPoint | null;
  /** Listes officielles : pharmacies de garde de la semaine, stations approvisionnées. */
  points?: MapPoint[];
  /** Lignes des listes officielles qu'on n'a pas su placer (restent dans la liste). */
  unplaced?: number;
  legend?: { level: MapLevel; label: string }[];
  /** « Tout le Niger » : cadrer d'abord autour de Niamey quand des points s'y trouvent. */
  home?: GeoPoint | null;
  /** Quartiers proposés par la recherche (la carte s'y centre). */
  places?: { name: string; lat: number; lng: number }[];
};

type Hit = { key: string; name: string; sub: string; lat: number; lng: number; zoom: number };

/** Minuscules, sans accents ni mots inutiles : « Pharmacie Gobi » = « gobi ». */
function plain(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(pharmacie|station|service|de|du|la|le|les|des)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Établissements placés sur la carte (inscrits avec leur position, listes officielles), et le client s'il s'est localisé. */
export function ServicesMap({ kind, items, fuel, position, points = [], unplaced = 0, legend, home = null, places = [] }: ServicesMapProps) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const stations = useRef<L.LayerGroup | null>(null);
  const me = useRef<L.Marker | null>(null);
  const framed = useRef("");
  // Marqueurs par clé, pour que la recherche ouvre la bonne bulle.
  const markers = useRef(new Map<string, L.Marker>());
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState("");

  // Création unique de la carte.
  useEffect(() => {
    if (!holder.current || map.current) return;
    const created = L.map(holder.current, { center: NIAMEY, zoom: 12, zoomControl: true });
    created.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(created);
    stations.current = L.layerGroup().addTo(created);
    map.current = created;
    return () => {
      created.remove();
      map.current = null;
      stations.current = null;
      me.current = null;
    };
  }, []);

  // Stations : marqueurs refaits à chaque liste ; cadrage seulement quand l'ensemble change.
  useEffect(() => {
    const layer = stations.current;
    const current = map.current;
    if (!layer || !current) return;
    layer.clearLayers();
    markers.current.clear();
    const placed = items.filter(isPlaced);
    for (const item of placed) {
      const marker = L.marker([item.latitude, item.longitude], {
        icon: markerIcon(itemLevel(kind, item, fuel), kind === "fuel_station" && item.on_duty),
        title: item.business_name,
        keyboard: true,
      })
        .bindPopup(() => popupContent(kind, item), POPUP)
        .addTo(layer);
      markers.current.set(`r:${item.outlet_id ?? item.vendor_id}`, marker);
    }
    for (const point of points) {
      const marker = L.marker([point.latitude, point.longitude], {
        icon: point.variant === "dot" ? DOT_ICON : markerIcon(point.level, false, point.approximate),
        title: point.name,
        keyboard: point.variant !== "dot",
        // Les points sûrs passent devant les points approximatifs, eux-mêmes devant les petits points gris.
        zIndexOffset: point.variant === "dot" ? -500 : point.approximate ? 0 : 500,
      })
        .bindPopup(() => pointContent(point), POPUP)
        .addTo(layer);
      markers.current.set(`p:${point.id}`, marker);
    }
    // Cadrage : les listes officielles d'abord (gardes de la semaine), sinon les établissements inscrits ;
    // sur « Tout le Niger », autour de Niamey s'il y en a (une station de Maradi ne dézoome pas tout le pays).
    // Les petits points gris (stations non inscrites) ne décident du cadrage que s'il n'y a rien d'autre.
    const main = points.filter((point) => point.variant !== "dot");
    const listed = main.length ? main : placed.length ? [] : points;
    const all: L.LatLngTuple[] = [
      ...listed.map((point): L.LatLngTuple => [point.latitude, point.longitude]),
      ...(main.length ? [] : placed.map((item): L.LatLngTuple => [item.latitude, item.longitude])),
    ];
    const near = home ? all.filter(([lat, lng]) => Math.abs(lat - home.lat) < 0.4 && Math.abs(lng - home.lng) < 0.4) : [];
    const spots = near.length ? near : all;
    const key = [...placed.map((item) => item.outlet_id ?? item.vendor_id), ...points.map((point) => point.id)].sort().join("|");
    if (key !== framed.current && !position && spots.length) {
      framed.current = key;
      current.fitBounds(L.latLngBounds(spots), { padding: [32, 32], maxZoom: 14 });
    }
  }, [kind, items, fuel, position, points, home]);

  // Le client : son point et la carte centrée sur lui.
  useEffect(() => {
    const current = map.current;
    if (!current || !position) return;
    const at: L.LatLngTuple = [position.lat, position.lng];
    if (me.current) me.current.setLatLng(at);
    else me.current = L.marker(at, { icon: ME_ICON, title: "Vous êtes ici", interactive: false }).addTo(current);
    current.setView(at, 13);
  }, [position]);

  // Recherche : établissements de la carte (inscrits, listes officielles, OpenStreetMap) puis quartiers.
  const hits = useMemo((): Hit[] => {
    const words = plain(query).split(" ").filter(Boolean);
    if (!words.length) return [];
    const match = (text: string) => {
      const value = plain(text);
      return words.every((word) => value.includes(word));
    };
    const found: Hit[] = [];
    for (const item of items.filter(isPlaced)) {
      if (match(`${item.business_name} ${item.address ?? ""} ${item.city ?? ""}`)) {
        found.push({
          key: `r:${item.outlet_id ?? item.vendor_id}`,
          name: item.business_name,
          sub: item.address || item.city || "Inscrit sur AMAZER",
          lat: item.latitude,
          lng: item.longitude,
          zoom: 16,
        });
      }
    }
    for (const point of points) {
      if (match(`${point.name} ${point.lines.join(" ")} ${point.area ?? ""}`)) {
        found.push({ key: `p:${point.id}`, name: point.name, sub: point.lines[0] ?? "", lat: point.latitude, lng: point.longitude, zoom: 16 });
      }
    }
    // Les noms qui commencent par le mot cherché d'abord, puis les quartiers.
    const ranked = found.sort((a, b) => Number(!plain(a.name).startsWith(words[0])) - Number(!plain(b.name).startsWith(words[0])));
    const zones = places
      .filter((place) => match(place.name))
      .map((place): Hit => ({ key: `q:${place.name}`, name: place.name, sub: "Quartier : la carte se centre dessus", lat: place.lat, lng: place.lng, zoom: 15 }));
    return [...ranked.slice(0, 6), ...zones.slice(0, 3)];
  }, [query, items, points, places]);

  const goTo = (hit: Hit) => {
    const current = map.current;
    if (!current) return;
    setPicked(hit.name);
    current.setView([hit.lat, hit.lng], hit.zoom);
    markers.current.get(hit.key)?.openPopup();
    holder.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const hidden = items.length - items.filter(isPlaced).length;
  const what = kind === "pharmacy" ? "une pharmacie" : "une station";
  return (
    <div className="space-y-2">
      {/* Recherche sur la carte : un nom (« Gobi », « Total ») ou un quartier (« Koira Kano »). */}
      <div className="relative">
        <label htmlFor={`${kind}-map-search`} className="sr-only">
          Chercher {what} ou un quartier sur la carte
        </label>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-500" aria-hidden="true" />
        <input
          id={`${kind}-map-search`}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPicked("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && hits[0]) {
              event.preventDefault();
              goTo(hits[0]);
            }
          }}
          placeholder={`Chercher ${what} ou un quartier`}
          autoComplete="off"
          className="h-12 w-full rounded-pill border border-border bg-card pl-12 pr-12 text-base text-ink-900 placeholder:text-ink-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setPicked("");
            }}
            aria-label="Effacer la recherche"
            className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-pill text-ink-600 hover:bg-surface-1"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {query.trim().length >= 2 && !picked ? (
        hits.length ? (
          <ul className="overflow-hidden rounded-card border border-border bg-card shadow-raised" aria-label="Résultats sur la carte">
            {hits.map((hit) => (
              <li key={hit.key} className="border-b border-border last:border-b-0">
                <button type="button" onClick={() => goTo(hit)} className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface-1">
                  <MapPin className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink-900">{hit.name}</span>
                    <span className="block truncate text-xs text-ink-600">{hit.sub}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-card border border-border bg-card px-4 py-3 text-sm text-ink-700" role="status">
            Rien trouvé sur la carte pour « {query.trim()} ». Essayez un autre nom ou le quartier.
          </p>
        )
      ) : null}
      <div
        ref={holder}
        className="isolate aspect-[4/3] w-full overflow-hidden rounded-card border border-border bg-surface-1 sm:aspect-video"
        role="region"
        aria-label={kind === "pharmacy" ? "Carte des pharmacies" : "Carte des stations"}
      />
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-700" aria-label="Légende de la carte">
        {(legend ?? LEGEND[kind]).map(({ level, label }) => (
          <li key={level} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded-full ${LEVEL_CLASS[level]}`} aria-hidden="true" />
            {label}
          </li>
        ))}
        {kind === "fuel_station" ? (
          <li className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-card ring-2 ring-ink-900" aria-hidden="true" />
            Cerclé : de garde
          </li>
        ) : null}
        {points.some((point) => point.variant === "dot") ? (
          <li className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink-400" aria-hidden="true" />
            {kind === "pharmacy"
              ? "Petit point gris : autre pharmacie (horaires habituels)"
              : "Petit point gris : station pas encore sur AMAZER (disponibilités inconnues)"}
          </li>
        ) : null}
        {points.some((point) => point.approximate) ? (
          <li className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-dashed border-ink-900" aria-hidden="true" />
            Pointillés : position approximative (quartier)
          </li>
        ) : null}
      </ul>
      {unplaced > 0 ? (
        <p className="text-xs text-ink-600">
          {unplaced === 1 ? "1 adresse de la liste officielle n'a pas pu être placée" : `${unplaced} adresses de la liste officielle n'ont pas pu être placées`} : voir la
          liste ci-dessous.
        </p>
      ) : null}
      {hidden > 0 ? (
        <p className="text-xs text-ink-600">
          {hidden === 1
            ? `1 ${kind === "pharmacy" ? "pharmacie" : "station"} n'a pas encore enregistré sa position`
            : `${hidden} ${kind === "pharmacy" ? "pharmacies" : "stations"} n'ont pas encore enregistré leur position`}{" "}
          : elle{hidden === 1 ? " est" : "s sont"} dans la liste.
        </p>
      ) : null}
    </div>
  );
}
