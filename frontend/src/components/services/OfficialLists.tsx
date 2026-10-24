"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Fuel, MapPin, Navigation, Phone, Search } from "lucide-react";

import { WhatsAppIcon } from "@/components/contact/WhatsAppButton";
import { telHref, whatsappHref } from "@/lib/local-services";
import { listOfficialLists } from "@/services/local-services-service";
import { FUEL_LABELS, type FuelKey, type OfficialList, type ServiceKind } from "@/types/local-services";

const actionClass =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-field border border-border bg-card px-3 text-sm font-semibold text-ink-800 hover:bg-surface-1";

function period(list: OfficialList): string {
  const fmt = (iso: string, withHour: boolean) =>
    new Date(iso).toLocaleString("fr-FR", {
      timeZone: "Africa/Niamey",
      weekday: "long",
      day: "numeric",
      month: "long",
      ...(withHour ? { hour: "2-digit", minute: "2-digit" } : {}),
    });
  return list.kind === "fuel_supply" ? `Valable le ${fmt(list.starts_at, false)}` : `Du ${fmt(list.starts_at, true)} au ${fmt(list.ends_at, true)}`;
}

const mapsSearch = (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
const plain = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function DutyPharmacies({ list, filter }: { list: OfficialList; filter: string }) {
  const wanted = plain(filter.trim());
  const entries = list.entries.filter((e) => !wanted || plain(`${e.name} ${e.district ?? ""} ${e.location ?? ""}`).includes(wanted));
  const groups = Array.from(new Set(entries.map((e) => e.group_label ?? "")));
  if (!entries.length) return <p className="mt-3 text-sm text-ink-600">Aucune pharmacie de garde ne correspond à « {filter} ».</p>;
  return (
    <div className="mt-3 space-y-4">
      {groups.map((group) => (
        <div key={group || "all"}>
          {group ? <h3 className="text-sm font-semibold uppercase tracking-label text-ink-600">Commune Niamey {group}</h3> : null}
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {entries
              .filter((e) => (e.group_label ?? "") === group)
              .map((e) => (
                <li key={`${e.name}-${e.district}`} className="flex flex-col rounded-field border border-border bg-card p-3">
                  <p className="font-semibold text-ink-900">Pharmacie {e.name}</p>
                  <p className="text-sm text-ink-700">{e.district}</p>
                  {e.location ? (
                    <p className="mt-1 flex items-start gap-1 text-xs text-ink-600">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {e.location}
                    </p>
                  ) : null}
                  <div className="mt-2 flex gap-2">
                    {e.phone ? (
                      <a href={telHref(e.phone)} className={`${actionClass} flex-1`}>
                        <Phone className="h-4 w-4" aria-hidden="true" />
                        {e.phone}
                      </a>
                    ) : null}
                    <a
                      href={mapsSearch(`Pharmacie ${e.name}, ${e.district ?? ""}, ${list.city}, Niger`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Itinéraire vers la pharmacie ${e.name}`}
                      className={actionClass}
                    >
                      <Navigation className="h-4 w-4" aria-hidden="true" />
                      Itinéraire
                    </a>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function FuelSupply({ list, filter }: { list: OfficialList; filter: string }) {
  const wanted = plain(filter.trim());
  const entries = list.entries.filter((e) => !wanted || plain(`${e.name} ${e.location ?? ""}`).includes(wanted));
  return (
    <div className="mt-3 space-y-3">
      {entries.length ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {entries.map((e) => (
            <li key={e.name}>
              <a
                href={mapsSearch(`Station ${list.brand ?? ""} ${e.name}, ${list.city}, Niger`)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Itinéraire vers la station ${e.name}`}
                className="flex min-h-11 items-center gap-2 rounded-field border border-success/30 bg-success/10 px-3 py-2 text-sm font-semibold text-ink-900 hover:bg-success/20"
              >
                <Fuel className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                <span className="min-w-0">
                  {e.name}
                  {e.location ? <span className="block text-xs font-normal text-ink-600">{e.location}</span> : null}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-600">Aucune station ne correspond à « {filter} ».</p>
      )}
      {list.contact_phone ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-700">
          <span>
            {list.brand} : {list.contact_address}
          </span>
          <a href={telHref(list.contact_phone)} className={actionClass}>
            <Phone className="h-4 w-4" aria-hidden="true" />
            {list.contact_phone}
          </a>
          <a
            href={whatsappHref(list.contact_phone, `Bonjour ${list.brand ?? ""}, je vous contacte depuis AMAZER au sujet de la disponibilité du carburant.`)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${actionClass} border-success text-success`}
          >
            <WhatsAppIcon className="h-4 w-4" />
            WhatsApp
          </a>
        </div>
      ) : null}
    </div>
  );
}

/** Listes officielles en cours (pharmacies de garde, stations approvisionnées), avec leur source et leur période. */
export function OfficialLists({ kind, city, fuel }: { kind: ServiceKind; city: string; fuel?: FuelKey | "" }) {
  const listKind = kind === "pharmacy" ? "pharmacy_duty" : "fuel_supply";
  const [filter, setFilter] = useState("");
  const { data } = useQuery({
    queryKey: ["official-lists", listKind, city],
    queryFn: () => listOfficialLists(listKind, city || undefined),
    staleTime: 60_000,
  });
  const lists = useMemo(() => (data ?? []).filter((l) => !fuel || l.kind !== "fuel_supply" || l.fuel === fuel), [data, fuel]);
  if (!lists.length) return null;

  return (
    <div className="mt-4 space-y-4">
      {lists.map((list) => (
        <section key={list.id} aria-labelledby={`official-${list.id}`} className="rounded-card border border-border bg-surface-1 p-4">
          <h2 id={`official-${list.id}`} className="flex items-center gap-2 text-lg font-semibold text-ink-900">
            <BadgeCheck className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
            {list.kind === "fuel_supply" && list.fuel ? `${list.title} (${FUEL_LABELS[list.fuel]})` : list.title}
          </h2>
          <p className="mt-1 text-sm text-ink-700">
            {period(list)} · {list.entries.length} {list.kind === "fuel_supply" ? "stations approvisionnées" : "pharmacies"}
          </p>
          <p className="text-xs text-ink-600">
            Source : {list.source}. Information officielle relayée par AMAZER : appelez avant de vous déplacer.
          </p>
          <label className="mt-3 flex h-11 items-center gap-2 rounded-field border border-border bg-card px-3 text-sm text-ink-900">
            <Search className="h-4 w-4 shrink-0 text-ink-500" aria-hidden="true" />
            <span className="sr-only">Chercher dans la liste</span>
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={list.kind === "fuel_supply" ? "Station ou quartier" : "Quartier ou pharmacie"}
              className="h-full w-full bg-transparent text-base outline-none"
            />
          </label>
          {list.kind === "fuel_supply" ? <FuelSupply list={list} filter={filter} /> : <DutyPharmacies list={list} filter={filter} />}
        </section>
      ))}
    </div>
  );
}
