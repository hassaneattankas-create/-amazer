"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, CheckCircle2, LocateFixed, MapPin, Plus, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { NIGER_REGION_CITIES, timeAgo } from "@/lib/local-services";
import { formatXOF } from "@/lib/currency";
import { bulkUpdateOutlets, createOutlet, deleteOutlet, getFuelNetwork, listMyOutlets, updateOutlet } from "@/services/local-services-service";
import { toast } from "@/store/toast-store";
import { FUEL_LABELS, type FuelKey, type FuelOutlet, type FuelOutletUpdate, type FuelState } from "@/types/local-services";

const FUELS: FuelKey[] = ["super", "gasoil", "gaz"];
const fieldClass =
  "mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-base text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

function OutletCard({ outlet, busy, onUpdate, onDelete }: { outlet: FuelOutlet; busy: boolean; onUpdate: (patch: FuelOutletUpdate, done: string) => void; onDelete: () => void }) {
  const [locating, setLocating] = useState(false);
  const locate = () => {
    if (!("geolocation" in navigator)) {
      toast.error("La localisation n'est pas disponible sur cet appareil.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onUpdate({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }, `Position de « ${outlet.name} » enregistrée.`);
      },
      () => {
        setLocating(false);
        toast.error("Position introuvable. Autorisez la localisation, puis réessayez depuis la station.");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  return (
    <li className={`rounded-field border border-border p-3 ${outlet.is_active ? "bg-card" : "bg-surface-1 opacity-70"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink-900">{outlet.name}</p>
          <p className="flex items-center gap-1 text-xs text-ink-600">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {[outlet.address, outlet.city].filter(Boolean).join(", ")}
            {outlet.latitude != null ? " · position enregistrée" : ""}
          </p>
        </div>
        {!outlet.is_active ? <span className="rounded-pill bg-surface-3 px-2 py-0.5 text-xs font-semibold text-ink-700">Fermée</span> : null}
      </div>

      {outlet.is_active ? (
        <div className="mt-3 space-y-2">
          {FUELS.map((fuel) => {
            const current = outlet.fuel[fuel] ?? null;
            const choose = (state: FuelState) =>
              onUpdate({ fuel: { [fuel]: state } }, `${outlet.name} — ${FUEL_LABELS[fuel]} : ${state === "available" ? "disponible" : "en rupture"}.`);
            return (
              <div key={fuel} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-sm font-semibold text-ink-900">{FUEL_LABELS[fuel]}</span>
                <div className="grid flex-1 grid-cols-2 gap-2" role="group" aria-label={`${FUEL_LABELS[fuel]} à ${outlet.name}`}>
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={current === "available"}
                    onClick={() => choose("available")}
                    className={`min-h-11 rounded-field border text-sm font-semibold ${current === "available" ? "border-success bg-success text-white" : "border-border bg-card text-ink-700 hover:border-success"}`}
                  >
                    Disponible
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={current === "out"}
                    onClick={() => choose("out")}
                    className={`min-h-11 rounded-field border text-sm font-semibold ${current === "out" ? "border-danger bg-danger text-white" : "border-border bg-card text-ink-700 hover:border-danger"}`}
                  >
                    Rupture
                  </button>
                </div>
              </div>
            );
          })}
          <p className={`flex items-start gap-1.5 text-xs ${outlet.fuel_fresh ? "text-ink-600" : "text-ink-800"}`}>
            {outlet.fuel_fresh ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
            )}
            {outlet.fuel_updated_at
              ? outlet.fuel_fresh
                ? `Mis à jour ${timeAgo(outlet.fuel_updated_at)}.`
                : `Dernière mise à jour ${timeAgo(outlet.fuel_updated_at)} : affichée « à confirmer ».`
              : "Pas encore d'information pour cette station."}
          </p>
        </div>
      ) : null}

      {outlet.is_active ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-700">
          <BarChart3 className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden="true" />
          30 derniers jours : {outlet.routes_30d ?? 0} itinéraire{(outlet.routes_30d ?? 0) > 1 ? "s" : ""} · {outlet.calls_30d ?? 0} appel
          {(outlet.calls_30d ?? 0) > 1 ? "s" : ""} · {outlet.gas_orders_30d ?? 0} commande{(outlet.gas_orders_30d ?? 0) > 1 ? "s" : ""} de gaz
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {outlet.is_active && outlet.fuel_updated_at ? (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onUpdate({ fuel: outlet.fuel }, `${outlet.name} : disponibilités confirmées.`)}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Rien n&apos;a changé
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="outline" disabled={busy || locating} onClick={locate}>
          <LocateFixed className="h-4 w-4" aria-hidden="true" />
          {locating ? "Localisation…" : "Position ici"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => onUpdate({ is_active: !outlet.is_active }, outlet.is_active ? `${outlet.name} est indiquée fermée.` : `${outlet.name} est rouverte.`)}
        >
          {outlet.is_active ? "Fermer" : "Rouvrir"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          aria-label={`Supprimer ${outlet.name}`}
          onClick={() => {
            if (window.confirm(`Supprimer le point de vente « ${outlet.name} » ?`)) onDelete();
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}

/** Une marque (ex. Oriba) déclare toutes ses stations ; chacune a ses disponibilités et sa position. */
export function FuelOutletsManager() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", city: "Niamey", address: "", phone: "" });
  const [bulkCity, setBulkCity] = useState("");
  const { data: outlets = [], isPending } = useQuery({ queryKey: ["fuel-outlets"], queryFn: listMyOutlets });
  const { data: network } = useQuery({ queryKey: ["fuel-network"], queryFn: getFuelNetwork });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["fuel-outlets"] });
    void queryClient.invalidateQueries({ queryKey: ["fuel-network"] });
  };
  const onError = (error: unknown) => toast.error(getApiErrorMessage(error, "Action impossible. Réessayez."));

  const create = useMutation({
    mutationFn: createOutlet,
    onSuccess: (outlet) => {
      toast.success(`Point de vente « ${outlet.name} » ajouté.`);
      setForm((prev) => ({ ...prev, name: "", address: "", phone: "" }));
      refresh();
    },
    onError,
  });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: FuelOutletUpdate; done: string }) => updateOutlet(id, patch),
    onSuccess: (_o, vars) => {
      toast.success(vars.done);
      refresh();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: deleteOutlet,
    onSuccess: () => {
      toast.success("Point de vente supprimé.");
      refresh();
    },
    onError,
  });
  const bulk = useMutation({
    mutationFn: (payload: { fuel?: { gaz?: "available" | "out" }; confirm?: boolean; done: string }) =>
      bulkUpdateOutlets({ fuel: payload.fuel, confirm: payload.confirm, city: bulkCity || undefined }),
    onSuccess: (_rows, vars) => {
      toast.success(vars.done);
      refresh();
    },
    onError,
  });
  const busy = create.isPending || update.isPending || remove.isPending || bulk.isPending;
  const outletCities = [...new Set(outlets.filter((o) => o.is_active).map((o) => o.city))];
  const where = bulkCity ? `à ${bulkCity}` : "partout";

  return (
    <section className="rounded-card border border-border bg-card p-4 shadow-resting sm:p-5" aria-labelledby="outlets-title">
      <h2 id="outlets-title" className="text-lg font-semibold text-ink-900">
        Mes points de vente {outlets.length ? `(${outlets.length})` : ""}
      </h2>
      <p className="mt-1 text-sm text-ink-600">
        Plusieurs stations sous votre marque ? Ajoutez-les : chacune apparaît dans « Où trouver de l&apos;essence » avec ses propres disponibilités.
      </p>

      {network ? (
        <div className="mt-3 rounded-field bg-brand-50 p-3 text-sm text-ink-800">
          <p className="font-semibold text-ink-900">
            {network.stations} station{network.stations > 1 ? "s" : ""} active{network.stations > 1 ? "s" : ""} · {network.with_gas} avec du gaz ·{" "}
            {network.to_confirm} à confirmer
          </p>
          {network.negotiated != null ? (
            <p className="mt-1">Votre abonnement : prix négocié de {formatXOF(network.negotiated)} par mois, toutes stations comprises.</p>
          ) : network.capped ? (
            <p className="mt-1">Votre abonnement : forfait réseau national {formatXOF(network.total)} par mois — stations illimitées.</p>
          ) : (
            <p className="mt-1">
              Votre abonnement : {formatXOF(network.total)} par mois ({network.included} stations incluses
              {network.extra ? `, + ${formatXOF(network.extra)} pour les suivantes` : ""}).
              {network.flat > 0 ? ` Plafonné à ${formatXOF(network.flat)} (forfait national, stations illimitées).` : ""}
            </p>
          )}
        </div>
      ) : null}

      {outlets.length > 1 ? (
        <div className="mt-3 rounded-field border border-border p-3">
          <p className="text-sm font-semibold text-ink-900">Mettre à jour plusieurs stations d&apos;un coup</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              aria-label="Stations concernées"
              value={bulkCity}
              onChange={(e) => setBulkCity(e.target.value)}
              className="h-10 rounded-field border border-border bg-card px-2 text-sm"
            >
              <option value="">Toutes les villes</option>
              {outletCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <Button type="button" size="sm" disabled={busy} onClick={() => bulk.mutate({ fuel: { gaz: "available" }, done: `Gaz disponible ${where}.` })}>
              Gaz disponible {where}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => bulk.mutate({ fuel: { gaz: "out" }, done: `Gaz en rupture ${where}.` })}>
              Gaz en rupture {where}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => bulk.mutate({ confirm: true, done: `Informations confirmées ${where}.` })}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Rien n&apos;a changé {where}
            </Button>
          </div>
        </div>
      ) : null}

      {isPending ? <div className="mt-3 h-24 animate-pulse rounded-field bg-surface-1" aria-busy="true" /> : null}
      {outlets.length ? (
        <ul className="mt-3 space-y-3">
          {outlets.map((outlet) => (
            <OutletCard
              key={outlet.id}
              outlet={outlet}
              busy={busy}
              onUpdate={(patch, done) => update.mutate({ id: outlet.id, patch, done })}
              onDelete={() => remove.mutate(outlet.id)}
            />
          ))}
        </ul>
      ) : null}

      <form
        className="mt-4 grid gap-2 rounded-field bg-surface-1 p-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (form.name.trim().length < 2) {
            toast.error("Donnez un nom à la station (ex. « Plateau » ou « Route de Zinder »).");
            return;
          }
          create.mutate({ name: form.name.trim(), city: form.city, address: form.address.trim() || undefined, phone: form.phone.trim() || undefined });
        }}
      >
        <p className="text-sm font-semibold text-ink-900 sm:col-span-2">Ajouter une station</p>
        <label className="text-sm font-medium text-ink-800">
          Nom de la station
          <input className={fieldClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex. Plateau" />
        </label>
        <label className="text-sm font-medium text-ink-800">
          Ville
          <select className={fieldClass} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>
            {NIGER_REGION_CITIES.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-ink-800">
          Adresse ou repère
          <input className={fieldClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Ex. Avenue de la Mairie" />
        </label>
        <label className="text-sm font-medium text-ink-800">
          Téléphone de la station (facultatif)
          <input className={fieldClass} value={form.phone} inputMode="tel" onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+227 …" />
        </label>
        {network && network.negotiated == null ? (
          <p className="text-xs text-ink-600 sm:col-span-2">
            {network.next_station_price > 0
              ? `Cette station ajoutera ${formatXOF(network.next_station_price)} par mois à votre abonnement.`
              : "Cette station est comprise dans votre abonnement."}
          </p>
        ) : null}
        <Button type="submit" disabled={busy} className="sm:col-span-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Ajouter la station
        </Button>
      </form>
    </section>
  );
}
