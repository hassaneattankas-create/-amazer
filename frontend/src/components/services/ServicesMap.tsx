"use client";

// Carte des stations et des pharmacies (Leaflet + fond OpenStreetMap, sans clé). Chargée à la demande depuis
// ServiceDirectory (next/dynamic, ssr: false) : la liste reste légère tant que la carte n'est pas ouverte.
import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useRef } from "react";

import type { GeoPoint } from "@/lib/local-services";
import { FUEL_LABELS, FUEL_STATE_LABELS, type FuelKey, type FuelState, type LocalServiceItem, type ServiceKind } from "@/types/local-services";

type Level = FuelState | "unknown";

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

function markerIcon(level: Level, onDuty: boolean): L.DivIcon {
  const ring = onDuty ? " ring-2 ring-ink-900 ring-offset-1" : "";
  return L.divIcon({
    className: "",
    html: `<span class="block h-7 w-7 rounded-full border-2 border-white shadow-raised ${LEVEL_CLASS[level]}${ring}"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

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

export type ServicesMapProps = {
  kind: ServiceKind;
  items: LocalServiceItem[];
  fuel: FuelKey | "";
  position: GeoPoint | null;
};

/** Établissements placés sur la carte (ceux qui ont enregistré leur position), et le client s'il s'est localisé. */
export function ServicesMap({ kind, items, fuel, position }: ServicesMapProps) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const stations = useRef<L.LayerGroup | null>(null);
  const me = useRef<L.Marker | null>(null);
  const framed = useRef("");

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
    const placed = items.filter(isPlaced);
    for (const item of placed) {
      L.marker([item.latitude, item.longitude], {
        icon: markerIcon(itemLevel(kind, item, fuel), kind === "fuel_station" && item.on_duty),
        title: item.business_name,
        keyboard: true,
      })
        .bindPopup(() => popupContent(kind, item), { autoPanPaddingTopLeft: [56, 24], autoPanPaddingBottomRight: [24, 24] })
        .addTo(layer);
    }
    const key = placed.map((item) => item.outlet_id ?? item.vendor_id).sort().join("|");
    if (key !== framed.current && !position && placed.length) {
      framed.current = key;
      current.fitBounds(L.latLngBounds(placed.map((item): L.LatLngTuple => [item.latitude, item.longitude])), {
        padding: [32, 32],
        maxZoom: 14,
      });
    }
  }, [kind, items, fuel, position]);

  // Le client : son point et la carte centrée sur lui.
  useEffect(() => {
    const current = map.current;
    if (!current || !position) return;
    const at: L.LatLngTuple = [position.lat, position.lng];
    if (me.current) me.current.setLatLng(at);
    else me.current = L.marker(at, { icon: ME_ICON, title: "Vous êtes ici", interactive: false }).addTo(current);
    current.setView(at, 13);
  }, [position]);

  const hidden = items.length - items.filter(isPlaced).length;
  return (
    <div className="space-y-2">
      <div
        ref={holder}
        className="isolate aspect-square w-full overflow-hidden rounded-card border border-border bg-surface-1 sm:aspect-video"
        role="region"
        aria-label={kind === "pharmacy" ? "Carte des pharmacies" : "Carte des stations"}
      />
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-700" aria-label="Légende de la carte">
        {LEGEND[kind].map(({ level, label }) => (
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
      </ul>
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
