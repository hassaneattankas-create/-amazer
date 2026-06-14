"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Ligne d'edition (champs en texte pour des inputs controles). */
export type RoomRow = {
  id?: string | null;
  name: string;
  night_price: string;
  capacity: string;
  amenities: string;
  deposit_amount: string;
  departure_times: string[];
};

export function emptyRoomRow(): RoomRow {
  return {
    name: "",
    night_price: "",
    capacity: "1",
    amenities: "",
    deposit_amount: "",
    departure_times: [],
  };
}

/** Formulaire visuel pour les trajets (transport) ou les chambres (hotel). */
export function RoomTypesEditor({
  value,
  onChange,
  isTransport,
}: {
  value: RoomRow[];
  onChange: (rows: RoomRow[]) => void;
  isTransport: boolean;
}) {
  const unitLabel = isTransport ? "place" : "nuit";
  const itemLabel = isTransport ? "trajet" : "chambre";

  function update(index: number, patch: Partial<RoomRow>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...value, emptyRoomRow()]);
  }
  function addTime(index: number) {
    update(index, { departure_times: [...value[index].departure_times, ""] });
  }
  function updateTime(index: number, timeIndex: number, time: string) {
    update(index, {
      departure_times: value[index].departure_times.map((t, ti) => (ti === timeIndex ? time : t)),
    });
  }
  function removeTime(index: number, timeIndex: number) {
    update(index, {
      departure_times: value[index].departure_times.filter((_, ti) => ti !== timeIndex),
    });
  }

  return (
    <div className="space-y-3 sm:col-span-2">
      {value.map((row, index) => (
        <div key={index} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">
              {isTransport ? "Trajet" : "Chambre"} {index + 1}
            </p>
            <button
              type="button"
              onClick={() => remove(index)}
              className="text-xs font-medium text-rose-600 hover:underline"
            >
              Supprimer
            </button>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-slate-600 sm:col-span-2">
              {isTransport ? "Nom du trajet (ex: Niamey - Maradi)" : "Nom de la chambre"}
              <Input
                value={row.name}
                onChange={(event) => update(index, { name: event.target.value })}
                placeholder={isTransport ? "Niamey - Maradi" : "Chambre Deluxe"}
              />
            </label>
            <label className="text-xs text-slate-600">
              Prix par {unitLabel} (FCFA)
              <Input
                type="number"
                min={0}
                value={row.night_price}
                onChange={(event) => update(index, { night_price: event.target.value })}
              />
            </label>
            <label className="text-xs text-slate-600">
              {isTransport ? "Nombre de places" : "Capacite"}
              <Input
                type="number"
                min={1}
                value={row.capacity}
                onChange={(event) => update(index, { capacity: event.target.value })}
              />
            </label>
            <label className="text-xs text-slate-600">
              Options (separees par virgule)
              <Input
                value={row.amenities}
                onChange={(event) => update(index, { amenities: event.target.value })}
                placeholder={isTransport ? "Climatise, WiFi, Bagages" : "Climatise, TV, Petit-dejeuner"}
              />
            </label>
            <label className="text-xs text-slate-600">
              Acompte (FCFA, optionnel)
              <Input
                type="number"
                min={0}
                value={row.deposit_amount}
                onChange={(event) => update(index, { deposit_amount: event.target.value })}
              />
            </label>
          </div>
          {isTransport ? (
            <div className="mt-2">
              <p className="text-xs font-medium text-slate-600">Heures de depart</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {row.departure_times.map((time, timeIndex) => (
                  <div key={timeIndex} className="flex items-center gap-1">
                    <input
                      type="time"
                      value={time}
                      onChange={(event) => updateTime(index, timeIndex, event.target.value)}
                      className="h-9 rounded-md border border-slate-300 px-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeTime(index, timeIndex)}
                      aria-label="Retirer cette heure"
                      className="text-xs text-rose-600"
                    >
                      x
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addTime(index)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                >
                  + Ajouter une heure
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ))}
      <Button
        type="button"
        onClick={add}
        className="border border-[#FF4D00]/30 bg-orange-50 text-[#FF4D00] hover:bg-orange-100"
      >
        + Ajouter un {itemLabel}
      </Button>
    </div>
  );
}

/** Conversion liste d'edition -> room_types envoye au backend. */
export function roomRowsToPayload(rows: RoomRow[]) {
  return rows
    .filter((row) => row.name.trim() && Number(row.night_price || 0) > 0)
    .map((row, index) => ({
      id: row.id || `room-${index + 1}`,
      name: row.name.trim(),
      description: null,
      night_price: Number(row.night_price || 0),
      capacity: Math.max(1, Number(row.capacity || 1)),
      amenities: row.amenities
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      photo_urls: [],
      deposit_amount: row.deposit_amount ? Number(row.deposit_amount) : null,
      departure_times: row.departure_times.map((time) => time.trim()).filter(Boolean),
    }));
}

/** Conversion profil charge -> lignes d'edition. */
export function payloadToRoomRows(
  rooms: Array<{
    id?: string | null;
    name?: string;
    night_price?: number;
    capacity?: number;
    amenities?: string[];
    deposit_amount?: number | null;
    departure_times?: string[];
  }>,
): RoomRow[] {
  return (rooms || []).map((room) => ({
    id: room.id ?? null,
    name: room.name || "",
    night_price: room.night_price != null ? String(room.night_price) : "",
    capacity: room.capacity != null ? String(room.capacity) : "1",
    amenities: (room.amenities || []).join(", "),
    deposit_amount: room.deposit_amount != null ? String(room.deposit_amount) : "",
    departure_times: room.departure_times || [],
  }));
}
