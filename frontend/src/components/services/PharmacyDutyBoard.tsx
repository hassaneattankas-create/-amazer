"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Clock3, MessageCircle, Navigation, Phone, Search, Share2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { distanceKm, type GeoPoint } from "@/lib/local-services";
import { getShopRoute } from "@/lib/mobile-routes";
import { getPharmacyDuty } from "@/services/local-services-service";
import type { PharmacyDutyItem, PharmacyDutyWeek } from "@/types/local-services";

const pillClass = (active: boolean) =>
  `inline-flex min-h-11 shrink-0 items-center gap-2 rounded-pill border px-4 text-sm font-medium transition-colors duration-fast ${
    active ? "border-ink-900 bg-ink-900 text-white" : "border-border bg-card text-ink-700 hover:border-ink-400"
  }`;

const actionClass =
  "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-field border border-border bg-card px-3 text-sm font-semibold text-ink-900 transition-colors duration-fast hover:border-ink-400";

function normalize(text: string | null | undefined): string {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Une pharmacie de garde : appeler, itinéraire, WhatsApp — en un geste. */
function DutyRow({ item, distance }: { item: PharmacyDutyItem; distance: number | null }) {
  return (
    <li className="rounded-card border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-ink-900">
            <span>Pharmacie {item.name}</span>
            {item.vendor_id ? (
              <Link href={getShopRoute(item.vendor_id)} className="inline-flex items-center gap-1 rounded-pill bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                {item.is_verified ? <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                Sur AMAZER
              </Link>
            ) : null}
          </p>
          {item.location ? <p className="mt-0.5 text-sm text-ink-700">{item.location}</p> : null}
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-600">
            <span className="inline-flex items-center gap-1 font-medium text-success">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              De garde {item.until_label}
            </span>
            {distance != null ? <span>à {distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}</span> : null}
          </p>
        </div>
        {item.commune ? <span className="shrink-0 rounded-pill bg-surface-1 px-2 py-1 text-xs font-medium text-ink-700">{item.commune}</span> : null}
      </div>
      <div className="mt-3 flex gap-2">
        {item.phone_link ? (
          <a href={`tel:${item.phone_link}`} className={actionClass} aria-label={`Appeler la pharmacie ${item.name} au ${item.phone ?? ""}`}>
            <Phone className="h-4 w-4 text-brand-600" aria-hidden="true" />
            {item.phone ?? "Appeler"}
          </a>
        ) : null}
        <a href={item.maps_url} target="_blank" rel="noopener noreferrer" className={actionClass} aria-label={`Itinéraire vers la pharmacie ${item.name}`}>
          <Navigation className="h-4 w-4 text-brand-600" aria-hidden="true" />
          Itinéraire
        </a>
        {item.whatsapp_link ? (
          <a href={item.whatsapp_link} target="_blank" rel="noopener noreferrer" className={`${actionClass} flex-none px-3`} aria-label={`WhatsApp de la pharmacie ${item.name}`}>
            <MessageCircle className="h-4 w-4 text-success" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Pharmacies de garde de la semaine (liste officielle publiée par AMAZER) : recherche par nom ou quartier,
 * commune, distance, appel et itinéraire en un geste, semaine prochaine, partage WhatsApp.
 */
export function PharmacyDutyBoard({ city, position }: { city: string; position: GeoPoint | null }) {
  const place = city || "Niamey";
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["pharmacy-duty", place],
    queryFn: () => getPharmacyDuty(place),
    staleTime: 60_000,
    refetchInterval: 600_000,
  });
  const [which, setWhich] = useState<"current" | "next">("current");
  const [commune, setCommune] = useState("");
  const [query, setQuery] = useState("");

  const week: PharmacyDutyWeek | null = (which === "next" ? data?.next : data?.current) ?? null;
  const communes = useMemo(() => [...new Set((week?.items ?? []).map((i) => i.commune).filter((c): c is string => Boolean(c)))], [week]);

  const rows = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    const list = [...(week?.items ?? []), ...(which === "current" ? (data?.declared ?? []) : [])]
      .filter((i) => !commune || i.commune === commune)
      .filter((i) => words.every((w) => normalize(`${i.name} ${i.location ?? ""} ${i.district ?? ""} ${i.commune ?? ""}`).includes(w)))
      .map((item) => ({
        item,
        distance: position && item.latitude != null && item.longitude != null ? distanceKm(position, { lat: item.latitude, lng: item.longitude }) : null,
      }));
    return position ? list.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)) : list;
  }, [week, data, which, commune, query, position]);

  const share = () => {
    if (!week) return;
    const lines = rows.map(({ item }) => `• ${item.name}${item.location ? ` — ${item.location}` : ""}${item.phone ? ` — ${item.phone}` : ""}`);
    const text = `Pharmacies de garde à ${place}, ${week.period_label}${commune ? ` (${commune})` : ""} :\n${lines.join("\n")}\n\nToute la liste, avec appel et itinéraire : https://amazer.store/pharmacies`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  if (isPending) return <div className="mt-6 h-72 animate-pulse rounded-card border border-border bg-surface-1" aria-busy="true" />;
  if (isError) {
    return (
      <div className="mt-6 rounded-card border border-border bg-card p-5 text-center">
        <p className="text-sm text-ink-700">Impossible de charger les pharmacies de garde. Vérifiez votre connexion.</p>
        <Button type="button" variant="outline" className="mt-3" onClick={() => void refetch()}>
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <section className="mt-6 space-y-4" aria-labelledby="duty-week-title">
      <div className="rounded-card border border-success/30 bg-success/5 p-4">
        <h2 id="duty-week-title" className="flex items-center gap-2 text-lg font-semibold text-ink-900">
          <ShieldCheck className="h-5 w-5 text-success" aria-hidden="true" />
          {week ? `De garde à ${place}, ${which === "next" ? "la semaine prochaine" : "cette semaine"}` : `Pharmacies de garde à ${place}`}
        </h2>
        {week ? (
          <>
            <p className="mt-1 text-sm font-medium text-ink-800">{week.period_label.replace(/^du /, "Du ")}</p>
            <p className="mt-0.5 text-xs text-ink-600">Liste officielle : {week.source}.</p>
          </>
        ) : (
          <p className="mt-1 text-sm text-ink-700">
            La liste officielle de {which === "next" ? "la semaine prochaine" : "cette semaine"} n&apos;est pas encore publiée ici.
            {data?.declared.length && which === "current" ? " Voici les pharmacies inscrites qui sont de garde." : ""}
          </p>
        )}
        {data?.next || which === "next" ? (
          <div className="mt-3 flex gap-2" role="group" aria-label="Semaine">
            <button type="button" aria-pressed={which === "current"} onClick={() => setWhich("current")} className={pillClass(which === "current")}>
              Cette semaine
            </button>
            <button type="button" aria-pressed={which === "next"} onClick={() => setWhich("next")} className={pillClass(which === "next")}>
              Semaine prochaine
            </button>
          </div>
        ) : null}
      </div>

      {week || rows.length ? (
        <>
          <label className="relative block">
            <span className="sr-only">Chercher une pharmacie ou un quartier</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-500" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nom ou quartier (ex. Koira Kano)"
              className="h-12 w-full rounded-pill border border-border bg-card pl-12 pr-4 text-base text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
          </label>
          {communes.length > 1 ? (
            <div className="-mx-gutter overflow-x-auto px-gutter">
              <div className="flex gap-2" role="group" aria-label="Commune">
                <button type="button" aria-pressed={!commune} onClick={() => setCommune("")} className={pillClass(!commune)}>
                  Toutes
                </button>
                {communes.map((c) => (
                  <button key={c} type="button" aria-pressed={commune === c} onClick={() => setCommune(c)} className={pillClass(commune === c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-ink-700" role="status">
              <strong className="text-ink-900">{rows.length}</strong> pharmacie{rows.length > 1 ? "s" : ""} de garde
              {position ? ", les plus proches d'abord" : ""}
            </p>
            {week && rows.length ? (
              <Button type="button" variant="outline" size="sm" className="min-h-11 shrink-0" onClick={share}>
                <Share2 className="h-4 w-4" aria-hidden="true" />
                Partager
              </Button>
            ) : null}
          </div>
          {rows.length ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map(({ item, distance }) => (
                <DutyRow key={`${item.official ? "o" : "a"}-${item.name}`} item={item} distance={distance} />
              ))}
            </ul>
          ) : (
            <p className="rounded-card border border-border bg-card p-5 text-sm text-ink-700">Aucune pharmacie de garde ne correspond à « {query} ».</p>
          )}
        </>
      ) : null}

      <p className="rounded-field bg-danger/5 px-4 py-3 text-sm text-ink-800">
        Urgence vitale : appelez le <a href="tel:15" className="font-semibold underline">15</a> (SAMU) ou le{" "}
        <a href="tel:18" className="font-semibold underline">18</a> (sapeurs-pompiers).
      </p>
    </section>
  );
}
