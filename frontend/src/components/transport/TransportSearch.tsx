"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, BadgeCheck, Bus, ChevronRight, Clock, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { listTransportCities, searchTransport } from "@/services/seller-service";
import type { TransportSearchResult } from "@/types/seller";

const fieldClass = "mt-1 h-12 w-full rounded-field border border-border bg-card px-3 text-base text-ink-900";

function isoDay(offset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function longDay(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

type Query = { origin: string; destination: string; day: string };

/** Un trajet d'une compagnie : itinéraire, prix par place et départs du jour (places restantes). */
function ResultCard({ row, day }: { row: TransportSearchResult; day: string }) {
  const via = row.cities.slice(1, -1);
  return (
    <li className="rounded-card border border-border bg-card p-4 shadow-resting">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-700">
            {row.company}
            {row.is_verified ? <BadgeCheck className="h-4 w-4 text-success" aria-label="Compagnie vérifiée" /> : null}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-lg font-semibold text-ink-900">
            {row.board_city}
            <ChevronRight className="h-4 w-4 text-ink-500" aria-hidden="true" />
            {row.alight_city}
          </p>
          <p className="mt-0.5 text-sm text-ink-600">
            {row.trip_name}
            {via.length ? ` · via ${via.join(", ")}` : ""}
            {row.duration ? ` · ${row.duration}` : ""}
          </p>
        </div>
        <p className="shrink-0 text-right">
          <span className="block text-xl font-semibold text-ink-900">{formatXOF(row.price)}</span>
          <span className="text-xs text-ink-600">par place</span>
        </p>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Départs">
        {row.departures.map((dep) => {
          const full = dep.seats_left <= 0;
          const params = new URLSearchParams({ trajet: row.trip_id, date: day });
          if (dep.time) params.set("heure", dep.time);
          const label = `${dep.time ?? "Départ"} · ${full ? "complet" : `${dep.seats_left} place${dep.seats_left > 1 ? "s" : ""}`}`;
          return (
            <li key={dep.time ?? "jour"}>
              {full ? (
                <span className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-border bg-surface-2 px-3 text-sm text-ink-500 line-through">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  {label}
                </span>
              ) : (
                <Link
                  href={`/shop/${row.vendor_id}?${params.toString()}#reserver`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-brand-300 bg-brand-50 px-3 text-sm font-semibold text-ink-900 transition-colors duration-fast hover:border-brand-500"
                >
                  <Clock className="h-4 w-4 text-brand-700" aria-hidden="true" />
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </li>
  );
}

/** Recherche de trajets : toutes les compagnies sur une seule page, du moins cher au plus cher. */
export function TransportSearch() {
  const [form, setForm] = useState<Query>({ origin: "", destination: "", day: isoDay(0) });
  const [query, setQuery] = useState<Query | null>(null);
  const { data: cities = [] } = useQuery({ queryKey: ["transport-cities"], queryFn: listTransportCities, staleTime: 600_000 });
  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["transport-search", query],
    queryFn: () => searchTransport(query?.origin ?? "", query?.destination ?? "", query?.day ?? isoDay(0)),
    enabled: query !== null,
    staleTime: 30_000,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setQuery({ origin: form.origin.trim(), destination: form.destination.trim(), day: form.day });
  };
  const quickDays = [
    { iso: isoDay(0), label: "Aujourd'hui" },
    { iso: isoDay(1), label: "Demain" },
    { iso: isoDay(2), label: "Après-demain" },
  ];

  return (
    <section className="mx-auto w-full max-w-container space-y-5 px-gutter py-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-ink-900">
          <Bus className="h-6 w-6 text-brand-600" aria-hidden="true" />
          Billets de bus
        </h1>
        <p className="text-sm text-ink-600">
          Toutes les compagnies sur une seule page : comparez les prix, les heures et les places restantes, puis réservez. Billet à QR code,
          report ou annulation jusqu&apos;à 2 h avant le départ.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-3 rounded-card border border-border bg-card p-4 shadow-resting">
        <datalist id="transport-cities">
          {cities.map((city) => (
            <option key={city} value={city} />
          ))}
        </datalist>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <label className="text-sm font-medium text-ink-800">
            Départ
            <input
              className={fieldClass}
              list="transport-cities"
              value={form.origin}
              onChange={(event) => setForm({ ...form, origin: event.target.value })}
              placeholder="Niamey"
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            onClick={() => setForm({ ...form, origin: form.destination, destination: form.origin })}
            className="mb-0.5 grid h-11 w-11 place-items-center rounded-field border border-border text-ink-700 hover:border-ink-400"
            aria-label="Inverser départ et arrivée"
          >
            <ArrowUpDown className="h-4 w-4 rotate-90" aria-hidden="true" />
          </button>
          <label className="text-sm font-medium text-ink-800">
            Arrivée
            <input
              className={fieldClass}
              list="transport-cities"
              value={form.destination}
              onChange={(event) => setForm({ ...form, destination: event.target.value })}
              placeholder="Zinder"
              autoComplete="off"
            />
          </label>
        </div>
        <fieldset>
          <legend className="text-sm font-medium text-ink-800">Date du voyage</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {quickDays.map((item) => (
              <button
                key={item.iso}
                type="button"
                onClick={() => setForm({ ...form, day: item.iso })}
                aria-pressed={form.day === item.iso}
                className={`min-h-11 rounded-pill border px-4 text-sm font-semibold ${
                  form.day === item.iso ? "border-brand-600 bg-brand-600 text-white" : "border-border bg-card text-ink-800"
                }`}
              >
                {item.label}
              </button>
            ))}
            <input
              type="date"
              min={isoDay(0)}
              value={form.day}
              onChange={(event) => event.target.value && setForm({ ...form, day: event.target.value })}
              className="h-11 rounded-pill border border-border bg-card px-3 text-sm text-ink-900"
              aria-label="Autre date"
            />
          </div>
        </fieldset>
        <Button type="submit" className="h-12 w-full bg-brand-600 text-base text-white hover:bg-brand-700" disabled={isFetching}>
          <Search aria-hidden="true" />
          {isFetching ? "Recherche…" : "Voir les départs"}
        </Button>
      </form>

      {query === null ? (
        <p className="flex items-center gap-2 text-sm text-ink-600">
          <Bus className="h-4 w-4" aria-hidden="true" />
          Laissez « Départ » ou « Arrivée » vide pour voir tous les départs du jour.
        </p>
      ) : isFetching && !data ? (
        <ul className="space-y-3" aria-hidden="true">
          {[0, 1, 2].map((key) => (
            <li key={key} className="h-36 animate-pulse rounded-card bg-surface-2" />
          ))}
        </ul>
      ) : isError ? (
        <div role="alert" className="rounded-card border border-danger/30 bg-danger/10 p-4 text-sm text-ink-900">
          {getApiErrorMessage(error, "La recherche n'a pas abouti. Vérifiez votre connexion puis réessayez.")}
          <Button type="button" variant="outline" className="ml-3" onClick={() => setQuery({ ...query })}>
            Réessayer
          </Button>
        </div>
      ) : data && data.length ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-700" aria-live="polite">
            {data.length} trajet{data.length > 1 ? "s" : ""} le {longDay(query.day)}, du moins cher au plus cher.
          </p>
          <ul className="space-y-3">
            {data.map((row) => (
              <ResultCard key={`${row.vendor_id}-${row.trip_id}`} row={row} day={query.day} />
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-card border border-border bg-card p-5 text-sm text-ink-700" aria-live="polite">
          <p className="font-semibold text-ink-900">Aucun départ trouvé le {longDay(query.day)}.</p>
          <p className="mt-1">
            Essayez une autre date, ou seulement la ville d&apos;arrivée. Les compagnies ajoutent leurs trajets au fur et à mesure.
          </p>
        </div>
      )}
    </section>
  );
}
