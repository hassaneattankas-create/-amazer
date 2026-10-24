"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { createAdminOfficialList, deleteAdminOfficialList, listAdminOfficialLists, type OfficialListInput } from "@/services/admin-official-lists-service";
import { toast } from "@/store/toast-store";
import type { FuelKey, OfficialList } from "@/types/local-services";

const fieldClass = "mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-base text-ink-900";
const labelClass = "block text-sm font-medium text-ink-800";

/** « 2026-10-31T08:00 » saisi à l'heure de Niamey (UTC+1) → ISO avec fuseau. */
const niameyIso = (local: string) => (local ? `${local}:00+01:00` : "");

function status(list: OfficialList): { label: string; tone: string } {
  const now = Date.now();
  if (new Date(list.ends_at).getTime() <= now) return { label: "Terminée", tone: "bg-surface-3 text-ink-700" };
  if (new Date(list.starts_at).getTime() > now) return { label: "À venir", tone: "bg-info/10 text-ink-900" };
  return { label: "En ligne", tone: "bg-success/10 text-success" };
}

const EMPTY = { kind: "pharmacy_duty" as OfficialList["kind"], city: "Niamey", title: "", source: "", brand: "", fuel: "super" as FuelKey, contact_phone: "", contact_address: "", starts: "", ends: "", lines: "" };

/** Publier les listes officielles : pharmacies de garde (chaque semaine) et stations approvisionnées (chaque jour). */
export default function AdminDutyListsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const { data: lists = [], isPending, isError } = useQuery({ queryKey: ["admin-official-lists"], queryFn: listAdminOfficialLists });
  const pharmacy = form.kind === "pharmacy_duty";

  const create = useMutation({
    mutationFn: () => {
      const payload: OfficialListInput = {
        kind: form.kind,
        city: form.city.trim() || "Niamey",
        title: form.title.trim(),
        source: form.source.trim(),
        brand: pharmacy ? null : form.brand.trim() || null,
        fuel: pharmacy ? null : form.fuel,
        contact_phone: pharmacy ? null : form.contact_phone.trim() || null,
        contact_address: pharmacy ? null : form.contact_address.trim() || null,
        starts_at: niameyIso(form.starts),
        ends_at: niameyIso(form.ends),
        lines: form.lines,
      };
      return createAdminOfficialList(payload);
    },
    onSuccess: (created) => {
      toast.success(`Liste publiée : ${created.entries.length} ligne(s).`);
      setForm({ ...EMPTY, kind: form.kind });
      void queryClient.invalidateQueries({ queryKey: ["admin-official-lists"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Publication impossible. Vérifiez les champs.")),
  });
  const remove = useMutation({
    mutationFn: deleteAdminOfficialList,
    onSuccess: () => {
      toast.success("Liste retirée.");
      void queryClient.invalidateQueries({ queryKey: ["admin-official-lists"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Suppression impossible.")),
  });

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 px-gutter pb-14 pt-4">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-ink-900">
          <CalendarClock className="h-6 w-6 text-brand-600" aria-hidden="true" />
          Gardes et approvisionnements
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Publiez la liste officielle des pharmacies de garde (chaque semaine) ou des stations approvisionnées (chaque jour). Elle s&apos;affiche
          sur les pages Pharmacies et Stations uniquement pendant sa période, avec sa source.
        </p>
      </header>

      <form
        className="space-y-4 rounded-card border border-border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <div className="flex flex-wrap gap-2" role="group" aria-label="Type de liste">
          {(["pharmacy_duty", "fuel_supply"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={form.kind === kind}
              onClick={() => setForm((prev) => ({ ...prev, kind }))}
              className={`min-h-11 rounded-pill border px-4 text-sm font-semibold ${form.kind === kind ? "border-ink-900 bg-ink-900 text-white" : "border-border bg-card text-ink-700"}`}
            >
              {kind === "pharmacy_duty" ? "Pharmacies de garde" : "Stations approvisionnées"}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Titre
            <input
              required
              className={fieldClass}
              value={form.title}
              onChange={(e) => set("title")(e.target.value)}
              placeholder={pharmacy ? "Pharmacies de garde · Niamey · Groupe n°3" : "Essence disponible · stations Oriba"}
            />
          </label>
          <label className={labelClass}>
            Source
            <input
              required
              className={fieldClass}
              value={form.source}
              onChange={(e) => set("source")(e.target.value)}
              placeholder={pharmacy ? "Comité de garde (ANRP, CNOP, MS/HP, SYNPHANI)" : "Communiqué Oriba Petrolium du …"}
            />
          </label>
          <label className={labelClass}>
            Ville
            <input className={fieldClass} value={form.city} onChange={(e) => set("city")(e.target.value)} />
          </label>
          {!pharmacy ? (
            <>
              <label className={labelClass}>
                Marque
                <input className={fieldClass} value={form.brand} onChange={(e) => set("brand")(e.target.value)} placeholder="Oriba Petrolium" />
              </label>
              <label className={labelClass}>
                Carburant
                <select className={fieldClass} value={form.fuel} onChange={(e) => set("fuel")(e.target.value)}>
                  <option value="super">Super (essence)</option>
                  <option value="gasoil">Gasoil</option>
                  <option value="gaz">Gaz</option>
                </select>
              </label>
              <label className={labelClass}>
                Téléphone de la marque
                <input className={fieldClass} inputMode="tel" value={form.contact_phone} onChange={(e) => set("contact_phone")(e.target.value)} />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Adresse de la marque
                <input className={fieldClass} value={form.contact_address} onChange={(e) => set("contact_address")(e.target.value)} />
              </label>
            </>
          ) : null}
          <label className={labelClass}>
            Début (heure de Niamey)
            <input required type="datetime-local" className={fieldClass} value={form.starts} onChange={(e) => set("starts")(e.target.value)} />
          </label>
          <label className={labelClass}>
            Fin (heure de Niamey)
            <input required type="datetime-local" className={fieldClass} value={form.ends} onChange={(e) => set("ends")(e.target.value)} />
          </label>
        </div>
        <label className={labelClass}>
          Lignes (une par {pharmacy ? "pharmacie" : "station"})
          <textarea
            required
            className={`${fieldClass} h-auto min-h-48 py-2 font-mono text-sm`}
            value={form.lines}
            onChange={(e) => set("lines")(e.target.value)}
            placeholder={pharmacy ? "1 | Issa-Beri | Plateau | En face CEG 5 Franco-Arabe | 20 74 28 98" : "Bonkaney 2 | Ex-Arewa\nPlateau"}
          />
          <span className="mt-1 block text-xs font-normal text-ink-600">
            {pharmacy
              ? "Format : commune | nom | quartier | localisation | téléphone (séparés par « | »)."
              : "Format : nom de la station, et si besoin « | précision »."}
          </span>
        </label>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Publication…" : "Publier la liste"}
        </Button>
      </form>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-ink-900">Listes publiées</h2>
        {isPending ? (
          <div className="h-24 animate-pulse rounded-card bg-surface-3" aria-busy="true" />
        ) : isError ? (
          <p className="text-sm text-danger">Listes indisponibles pour le moment.</p>
        ) : lists.length === 0 ? (
          <p className="text-sm text-ink-600">Aucune liste publiée.</p>
        ) : (
          <ul className="space-y-2">
            {lists.map((list) => {
              const state = status(list);
              return (
                <li key={list.id} className="flex items-start justify-between gap-3 rounded-field border border-border bg-card p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900">
                      {list.title} <span className={`ml-1 rounded-pill px-2 py-0.5 text-xs font-semibold ${state.tone}`}>{state.label}</span>
                    </p>
                    <p className="text-ink-700">
                      {new Date(list.starts_at).toLocaleString("fr-FR", { timeZone: "Africa/Niamey", dateStyle: "short", timeStyle: "short" })} →{" "}
                      {new Date(list.ends_at).toLocaleString("fr-FR", { timeZone: "Africa/Niamey", dateStyle: "short", timeStyle: "short" })} · {list.entries.length}{" "}
                      ligne(s)
                    </p>
                    <p className="text-xs text-ink-600">Source : {list.source}</p>
                  </div>
                  <button
                    type="button"
                    disabled={remove.isPending}
                    aria-label={`Retirer ${list.title}`}
                    onClick={() => {
                      if (window.confirm(`Retirer « ${list.title} » ?`)) remove.mutate(list.id);
                    }}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-field text-ink-600 hover:bg-surface-2 hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
