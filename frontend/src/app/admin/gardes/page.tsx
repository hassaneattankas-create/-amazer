"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Camera, ClipboardList, Fuel, Pill, Trash2 } from "lucide-react";

import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  createAdminOfficialList,
  deleteAdminOfficialList,
  listAdminOfficialLists,
  readDutyPhoto,
  type OfficialListInput,
} from "@/services/admin-official-lists-service";
import { toast } from "@/store/toast-store";
import type { FuelKey, OfficialList } from "@/types/local-services";

const fieldClass = "mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-base text-ink-900";
const labelClass = "block text-sm font-medium text-ink-800";

/** « 2026-10-31T08:00 » saisi à l'heure de Niamey (UTC+1) → ISO avec fuseau. */
const niameyIso = (local: string) => (local ? `${local}:00+01:00` : "");

/** Semaine de garde en cours, à l'heure de Niamey : du dernier samedi 8 h au samedi suivant 8 h. */
function dutyWeek(): { starts: string; ends: string } {
  const niamey = new Date(Date.now() + 3600_000); // UTC+1 lu en UTC
  const back = (niamey.getUTCDay() - 6 + 7) % 7;
  const start = new Date(Date.UTC(niamey.getUTCFullYear(), niamey.getUTCMonth(), niamey.getUTCDate() - back, 8));
  if (start.getTime() > niamey.getTime()) start.setUTCDate(start.getUTCDate() - 7);
  const end = new Date(start.getTime() + 7 * 86400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 16);
  return { starts: fmt(start), ends: fmt(end) };
}

const short = (local: string) => (local ? `${local.slice(8, 10)}/${local.slice(5, 7)}` : "");
const dutyTitle = (city: string, starts: string, ends: string) =>
  `Pharmacies de garde · ${city || "Niamey"} · du ${short(starts)} au ${short(ends)}/${ends.slice(0, 4)}`;

/** Réduit la photo dans le téléphone (1600 px, JPEG) : envoi rapide et sous la limite du relais. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image"));
      el.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.88).split(",")[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}

function status(list: OfficialList): { label: string; tone: string } {
  const now = Date.now();
  if (new Date(list.ends_at).getTime() <= now) return { label: "Terminée", tone: "bg-surface-3 text-ink-700" };
  if (new Date(list.starts_at).getTime() > now) return { label: "À venir", tone: "bg-info/10 text-ink-900" };
  return { label: "En ligne", tone: "bg-success/10 text-success" };
}

const PHARMACY_SOURCE = "MS/HP (Ministère de la Santé et de l'Hygiène Publique)";
const emptyPharmacy = () => ({ city: "Niamey", source: PHARMACY_SOURCE, ...dutyWeek(), lines: "" });
const EMPTY_FUEL = { city: "Niamey", title: "", source: "", brand: "", fuel: "super" as FuelKey, contact_phone: "", contact_address: "", starts: "", ends: "", lines: "" };

/** Gardes des pharmacies (photo de l'affiche → vérifier → publier) et stations approvisionnées. */
export default function AdminDutyListsPage() {
  const queryClient = useQueryClient();
  const [duty, setDuty] = useState(emptyPharmacy);
  const [fuel, setFuel] = useState(EMPTY_FUEL);
  const [photoName, setPhotoName] = useState("");
  const { data: lists = [], isPending, isError } = useQuery({ queryKey: ["admin-official-lists"], queryFn: listAdminOfficialLists });
  const lineCount = duty.lines.split("\n").filter((l) => l.trim()).length;
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin-official-lists"] });

  const read = useMutation({
    mutationFn: async (file: File) => readDutyPhoto({ mime: "image/jpeg", data: await shrink(file) }),
    onSuccess: (result) => {
      setDuty((prev) => ({
        ...prev,
        city: result.city || prev.city,
        starts: result.starts_at ?? prev.starts,
        ends: result.ends_at ?? prev.ends,
        lines: result.lines,
      }));
      toast.success(`${result.count} pharmacies lues. Vérifiez la liste, puis publiez.`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "La photo n'a pas pu être lue. Réessayez ou collez la liste.")),
  });

  const publish = useMutation({
    mutationFn: (payload: OfficialListInput) => createAdminOfficialList(payload),
    onSuccess: (created) => {
      toast.success(`Liste publiée : ${created.entries.length} ligne(s). Elle est en ligne pendant sa période.`);
      refresh();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Publication impossible. Vérifiez les champs.")),
  });
  const remove = useMutation({
    mutationFn: deleteAdminOfficialList,
    onSuccess: () => {
      toast.success("Liste retirée.");
      refresh();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Suppression impossible.")),
  });

  const publishDuty = () =>
    publish.mutate(
      {
        kind: "pharmacy_duty",
        city: duty.city.trim() || "Niamey",
        title: dutyTitle(duty.city.trim(), duty.starts, duty.ends),
        source: duty.source.trim() || PHARMACY_SOURCE,
        brand: null,
        fuel: null,
        contact_phone: null,
        contact_address: null,
        starts_at: niameyIso(duty.starts),
        ends_at: niameyIso(duty.ends),
        lines: duty.lines,
      },
      { onSuccess: () => { setDuty(emptyPharmacy()); setPhotoName(""); } }
    );

  const publishFuel = () =>
    publish.mutate(
      {
        kind: "fuel_supply",
        city: fuel.city.trim() || "Niamey",
        title: fuel.title.trim(),
        source: fuel.source.trim(),
        brand: fuel.brand.trim() || null,
        fuel: fuel.fuel,
        contact_phone: fuel.contact_phone.trim() || null,
        contact_address: fuel.contact_address.trim() || null,
        starts_at: niameyIso(fuel.starts),
        ends_at: niameyIso(fuel.ends),
        lines: fuel.lines,
      },
      { onSuccess: () => setFuel(EMPTY_FUEL) }
    );

  const live = lists.filter((l) => status(l).label !== "Terminée");

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 px-gutter pb-14 pt-4">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-ink-900">
          <CalendarClock className="h-6 w-6 text-brand-600" aria-hidden="true" />
          Gardes et approvisionnements
        </h1>
        <p className="mt-1 text-sm text-ink-600">Chaque semaine : envoyez la photo de l&apos;affiche des pharmacies de garde, vérifiez, publiez. C&apos;est tout.</p>
      </header>

      <Accordion defaultOpen={["pharmacies"]}>
        <AccordionItem
          id="pharmacies"
          headingLevel={2}
          icon={<Pill className="h-5 w-5" />}
          title="Pharmacies de garde de la semaine"
          description="Photo de l'affiche → vérifier → publier"
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              publishDuty();
            }}
          >
            <div className="rounded-field bg-surface-1 p-4">
              <p className="text-sm font-semibold text-ink-900">1. La photo de l&apos;affiche</p>
              <p className="mt-0.5 text-sm text-ink-600">Celle reçue sur WhatsApp suffit. AMAZER lit les pharmacies, les communes, les numéros et les dates.</p>
              <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-field bg-ink-900 px-4 text-sm font-semibold text-white">
                <Camera className="h-4 w-4" aria-hidden="true" />
                {read.isPending ? "Lecture en cours… (jusqu'à une minute)" : photoName ? "Choisir une autre photo" : "Choisir la photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={read.isPending}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    setPhotoName(file.name);
                    read.mutate(file);
                  }}
                />
              </label>
              {photoName ? <p className="mt-2 text-xs text-ink-600">Photo : {photoName}</p> : null}
            </div>

            <div>
              <p className="text-sm font-semibold text-ink-900">2. Vérifiez</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <label className={labelClass}>
                  Ville
                  <input className={fieldClass} value={duty.city} onChange={(e) => setDuty({ ...duty, city: e.target.value })} />
                </label>
                <label className={labelClass}>
                  Du (8 h en général)
                  <input required type="datetime-local" className={fieldClass} value={duty.starts} onChange={(e) => setDuty({ ...duty, starts: e.target.value })} />
                </label>
                <label className={labelClass}>
                  Au
                  <input required type="datetime-local" className={fieldClass} value={duty.ends} onChange={(e) => setDuty({ ...duty, ends: e.target.value })} />
                </label>
              </div>
              <label className={`${labelClass} mt-3`}>
                Pharmacies ({lineCount}) — une par ligne : commune | nom | quartier | localisation | téléphone
                <textarea
                  required
                  className={`${fieldClass} h-auto min-h-56 py-2 font-mono text-sm`}
                  value={duty.lines}
                  onChange={(e) => setDuty({ ...duty, lines: e.target.value })}
                  placeholder={"Commune I | Gobi |  | Koira Kano, en face du CEG 14 | 80 06 31 26"}
                />
              </label>
              <label className={`${labelClass} mt-3`}>
                Source affichée aux clients
                <input className={fieldClass} value={duty.source} onChange={(e) => setDuty({ ...duty, source: e.target.value })} />
              </label>
            </div>

            <div>
              <p className="text-sm font-semibold text-ink-900">3. Publiez</p>
              <p className="mt-0.5 text-sm text-ink-600">
                {duty.starts && duty.ends ? `« ${dutyTitle(duty.city, duty.starts, duty.ends)} » ` : ""}
                s&apos;affiche sur la page Pharmacies pendant sa période. Les pharmacies inscrites qui y figurent passent de garde toutes seules.
              </p>
              <Button type="submit" size="lg" className="mt-3" disabled={publish.isPending || read.isPending || lineCount === 0}>
                {publish.isPending ? "Publication…" : `Publier les ${lineCount} pharmacies de garde`}
              </Button>
            </div>
          </form>
        </AccordionItem>

        <AccordionItem
          id="published"
          headingLevel={2}
          icon={<ClipboardList className="h-5 w-5" />}
          title="Listes publiées"
          meta={live.length ? `${live.length} en ligne ou à venir` : undefined}
        >
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
                        {new Date(list.ends_at).toLocaleString("fr-FR", { timeZone: "Africa/Niamey", dateStyle: "short", timeStyle: "short" })} ·{" "}
                        {list.entries.length} ligne(s)
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
        </AccordionItem>

        <AccordionItem id="fuel" headingLevel={2} icon={<Fuel className="h-5 w-5" />} title="Stations approvisionnées" description="Communiqué d'une marque (ex. Oriba), pour un jour">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              publishFuel();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                Titre
                <input required className={fieldClass} value={fuel.title} onChange={(e) => setFuel({ ...fuel, title: e.target.value })} placeholder="Essence disponible · stations Oriba" />
              </label>
              <label className={labelClass}>
                Source
                <input required className={fieldClass} value={fuel.source} onChange={(e) => setFuel({ ...fuel, source: e.target.value })} placeholder="Communiqué Oriba Petrolium du …" />
              </label>
              <label className={labelClass}>
                Ville
                <input className={fieldClass} value={fuel.city} onChange={(e) => setFuel({ ...fuel, city: e.target.value })} />
              </label>
              <label className={labelClass}>
                Marque
                <input className={fieldClass} value={fuel.brand} onChange={(e) => setFuel({ ...fuel, brand: e.target.value })} placeholder="Oriba Petrolium" />
              </label>
              <label className={labelClass}>
                Carburant
                <select className={fieldClass} value={fuel.fuel} onChange={(e) => setFuel({ ...fuel, fuel: e.target.value as FuelKey })}>
                  <option value="super">Super (essence)</option>
                  <option value="gasoil">Gasoil</option>
                  <option value="gaz">Gaz</option>
                </select>
              </label>
              <label className={labelClass}>
                Téléphone de la marque
                <input className={fieldClass} inputMode="tel" value={fuel.contact_phone} onChange={(e) => setFuel({ ...fuel, contact_phone: e.target.value })} />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Adresse de la marque
                <input className={fieldClass} value={fuel.contact_address} onChange={(e) => setFuel({ ...fuel, contact_address: e.target.value })} />
              </label>
              <label className={labelClass}>
                Début (heure de Niamey)
                <input required type="datetime-local" className={fieldClass} value={fuel.starts} onChange={(e) => setFuel({ ...fuel, starts: e.target.value })} />
              </label>
              <label className={labelClass}>
                Fin (heure de Niamey)
                <input required type="datetime-local" className={fieldClass} value={fuel.ends} onChange={(e) => setFuel({ ...fuel, ends: e.target.value })} />
              </label>
            </div>
            <label className={labelClass}>
              Stations (une par ligne : nom | précision)
              <textarea required className={`${fieldClass} h-auto min-h-40 py-2 font-mono text-sm`} value={fuel.lines} onChange={(e) => setFuel({ ...fuel, lines: e.target.value })} placeholder={"Bonkaney 2 | Ex-Arewa\nPlateau"} />
            </label>
            <Button type="submit" disabled={publish.isPending}>
              {publish.isPending ? "Publication…" : "Publier la liste"}
            </Button>
          </form>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
