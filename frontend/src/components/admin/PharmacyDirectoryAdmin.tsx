"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { listAdminPharmacyDirectory, updateAdminPharmacyListing } from "@/services/admin-official-lists-service";
import { toast } from "@/store/toast-store";
import type { PharmacyListing } from "@/types/local-services";

type Filter = "all" | "todo" | "fixed";

const FILTERS: Array<[Filter, string]> = [
  ["all", "Toutes"],
  ["todo", "À placer"],
  ["fixed", "Corrigées"],
];

const plain = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** À placer : position approximative (centre du quartier) ou inconnue. */
const toPlace = (p: PharmacyListing) => p.latitude == null || p.position_source === "quartier";

function sourceLabel(p: PharmacyListing): { text: string; tone: string } {
  if (p.latitude == null) return { text: "Sans position", tone: "bg-danger/10 text-danger" };
  if (p.position_source === "admin") return { text: "Corrigée par AMAZER", tone: "bg-success/10 text-success" };
  if (p.position_source === "quartier") return { text: `Approximative${p.area ? ` (quartier ${p.area})` : ""}`, tone: "bg-warning/15 text-ink-800" };
  return { text: "Exacte (OpenStreetMap)", tone: "bg-surface-2 text-ink-700" };
}

/** Une ligne de l'annuaire, avec la correction de position et de numéro. */
function ListingRow({ listing }: { listing: PharmacyListing }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [phone, setPhone] = useState(listing.phone ?? "");
  const save = useMutation({
    mutationFn: () =>
      updateAdminPharmacyListing(listing.id, {
        ...(link.trim() ? { maps_link: link.trim() } : {}),
        ...(phone.trim() !== (listing.phone ?? "") ? { phone: phone.trim() } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-pharmacy-directory"] });
      toast.success(`Pharmacie ${listing.name} mise à jour.`);
      setOpen(false);
      setLink("");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Mise à jour impossible.")),
  });
  const label = sourceLabel(listing);
  return (
    <li className="rounded-field border border-border bg-card p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink-900">Pharmacie {listing.name}</p>
          <p className="text-ink-700">{[listing.location, listing.district].filter(Boolean).join(" · ") || "Repère non renseigné"}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-pill px-2 py-0.5 font-semibold ${label.tone}`}>{label.text}</span>
            <span className="text-ink-600">{listing.phone ?? "Numéro inconnu"}</span>
            {listing.latitude != null && listing.longitude != null ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${listing.latitude},${listing.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand-700 hover:underline"
              >
                Voir sur Google Maps
              </a>
            ) : null}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          {open ? "Fermer" : "Corriger"}
        </Button>
      </div>
      {open ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!link.trim() && phone.trim() === (listing.phone ?? "")) {
              toast.error("Collez un lien Google Maps ou changez le numéro.");
              return;
            }
            save.mutate();
          }}
        >
          <label className="block text-xs font-medium text-ink-800">
            Lien Google Maps de la pharmacie, ou « latitude, longitude »
            <input
              className="mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-base text-ink-900"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://maps.app.goo.gl/… ou 13.5137, 2.1098"
              inputMode="url"
            />
          </label>
          <label className="block text-xs font-medium text-ink-800">
            Numéro
            <input
              className="mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-base text-ink-900"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
            />
          </label>
          <p className="text-xs text-ink-600">
            Dans Google Maps, appuyez longuement sur la pharmacie, puis copiez les coordonnées ou le lien de partage. Une position corrigée n&apos;est
            plus jamais remplacée automatiquement.
          </p>
          <Button type="submit" size="sm" disabled={save.isPending}>
            {save.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      ) : null}
    </li>
  );
}

/**
 * Annuaire permanent des pharmacies (Admin › Gardes) : toutes les pharmacies connues, de garde ou non,
 * avec leur position et leur numéro ; corriger une position approximative ou manquante.
 */
export function PharmacyDirectoryAdmin({ city = "Niamey" }: { city?: string }) {
  const { data = [], isPending, isError } = useQuery({
    queryKey: ["admin-pharmacy-directory", city],
    queryFn: () => listAdminPharmacyDirectory(city),
  });
  const [filter, setFilter] = useState<Filter>("todo");
  const [query, setQuery] = useState("");
  const counts = useMemo(
    () => ({ all: data.length, todo: data.filter(toPlace).length, fixed: data.filter((p) => p.position_source === "admin").length }),
    [data]
  );
  const rows = useMemo(() => {
    const words = plain(query).split(/\s+/).filter(Boolean);
    return data
      .filter((p) => (filter === "todo" ? toPlace(p) : filter === "fixed" ? p.position_source === "admin" : true))
      .filter((p) => words.every((w) => plain(`${p.name} ${p.location ?? ""} ${p.district ?? ""} ${p.area ?? ""}`).includes(w)));
  }, [data, filter, query]);

  if (isPending) return <div className="h-24 animate-pulse rounded-card bg-surface-3" aria-busy="true" />;
  if (isError) return <p className="text-sm text-danger">Annuaire indisponible pour le moment.</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-700">
        Toutes les pharmacies de {city} connues d&apos;AMAZER : celles d&apos;OpenStreetMap et celles de chaque affiche de garde. Elles restent sur la
        carte même quand elles ne sont pas de garde. Placez celles dont la position est approximative ou inconnue.
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtre de l'annuaire">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`min-h-9 rounded-pill border px-3 text-xs font-medium ${
              filter === key ? "border-ink-900 bg-ink-900 text-white" : "border-border bg-card text-ink-700 hover:border-ink-400"
            }`}
          >
            {label} ({counts[key]})
          </button>
        ))}
      </div>
      <label className="sr-only" htmlFor="pharmacy-directory-search">
        Chercher une pharmacie
      </label>
      <input
        id="pharmacy-directory-search"
        className="h-11 w-full rounded-field border border-border bg-card px-3 text-base text-ink-900"
        placeholder="Nom ou quartier"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {rows.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-ink-600">
          <MapPin className="h-4 w-4" aria-hidden="true" />
          {filter === "todo" && !query ? "Toutes les pharmacies ont une position exacte." : "Aucune pharmacie ne correspond."}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.slice(0, 60).map((listing) => (
            <ListingRow key={listing.id} listing={listing} />
          ))}
        </ul>
      )}
      {rows.length > 60 ? <p className="text-xs text-ink-600">60 premières sur {rows.length} : précisez la recherche.</p> : null}
    </div>
  );
}
