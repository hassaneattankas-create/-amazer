"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bus, CheckCircle2, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { createHotelBooking, getTripSeats } from "@/services/seller-service";
import type { HotelRoomType } from "@/types/seller";

const fieldClass = "mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900";

function isoDay(offset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function dayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

/** Reservation d'un trajet (modele FlixBus) : trajet -> jour -> heure (places restantes) -> passagers -> billet. */
export function TransportBookingFlow({
  vendorId,
  companyName,
  trips,
  acceptsBookings,
  payoutPhone,
}: {
  vendorId: string;
  companyName: string;
  trips: HotelRoomType[];
  acceptsBookings: boolean;
  payoutPhone: string | null | undefined;
}) {
  const [tripId, setTripId] = useState<string | null>(trips.length === 1 ? String(trips[0].id ?? trips[0].name) : null);
  const [day, setDay] = useState("");
  const [time, setTime] = useState<string | null>(null);
  const [seats, setSeats] = useState(1);
  const [form, setForm] = useState({ name: "", phone: "", method: "nita" as "nita" | "amana", reference: "" });
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const trip = trips.find((item) => String(item.id ?? item.name) === tripId) ?? null;
  const today = isoDay(0);

  const days = useMemo(() => {
    if (!trip) return [];
    const published = (trip.available_days ?? []).filter((d) => d >= today).sort();
    return published.length ? published.slice(0, 14) : Array.from({ length: 7 }, (_, i) => isoDay(i));
  }, [trip, today]);

  const { data: seatData, isFetching } = useQuery({
    queryKey: ["trip-seats", vendorId, tripId, day],
    queryFn: () => getTripSeats(vendorId, tripId ?? "", day),
    enabled: Boolean(acceptsBookings && tripId && day),
    staleTime: 20_000,
  });
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const times = Object.entries(seatData?.seats_left ?? {}).filter(([value]) => {
    if (!value || day !== today) return true;
    const [h, m] = value.split(":").map(Number);
    return h * 60 + m > nowMinutes;
  });
  const left = time !== null ? seatData?.seats_left[time] ?? 0 : 0;
  const total = trip ? trip.night_price * seats : 0;

  const booking = useMutation({
    mutationFn: () => {
      const next = new Date(`${day}T12:00:00`);
      next.setDate(next.getDate() + 1);
      return createHotelBooking(vendorId, {
        vendor_id: vendorId,
        room_type_id: tripId ?? "",
        guest_name: form.name.trim(),
        guest_phone: form.phone.trim(),
        check_in_date: day,
        check_out_date: next.toISOString().slice(0, 10),
        guest_count: seats,
        deposit_payment_method: form.method,
        transaction_reference: form.reference.trim() || undefined,
        departure_time: time || undefined,
      });
    },
    onSuccess: () => {
      setResult({ ok: true, text: `Demande envoyée à ${companyName}. Votre billet à QR code apparaît dans « Mon compte » dès la confirmation.` });
      setTime(null);
    },
    onError: (error) => setResult({ ok: false, text: getApiErrorMessage(error, "Réservation impossible. Connectez-vous puis réessayez.") }),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResult(null);
    booking.mutate();
  };

  if (!trips.length) {
    return <p className="rounded-card border border-border bg-card p-6 text-sm text-ink-600">Cette compagnie n&apos;a pas encore publié ses trajets.</p>;
  }

  return (
    <section aria-labelledby="trips-title" className="space-y-4">
      <h2 id="trips-title" className="flex items-center gap-2 text-xl font-semibold text-ink-900">
        <Bus className="h-5 w-5 text-brand-600" aria-hidden="true" />
        Trajets
      </h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {trips.map((item) => {
          const id = String(item.id ?? item.name);
          return (
            <li key={id}>
              <button
                type="button"
                aria-pressed={tripId === id}
                onClick={() => {
                  setTripId(id);
                  setDay("");
                  setTime(null);
                  setResult(null);
                }}
                className={`w-full rounded-card border bg-card p-4 text-left ${tripId === id ? "border-brand-600" : "border-border hover:border-ink-400"}`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-ink-900">{item.name}</span>
                  <span className="shrink-0 text-right">
                    <span className="block font-bold text-ink-900">{formatXOF(item.night_price)}</span>
                    <span className="text-xs text-ink-600">par place</span>
                  </span>
                </span>
                {item.departure_times?.length ? (
                  <span className="mt-1 flex items-center gap-1 text-sm text-ink-700">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    Départs : {item.departure_times.join(" · ")}
                  </span>
                ) : null}
                {item.amenities.length ? <span className="mt-1 block text-xs text-ink-600">{item.amenities.join(" · ")}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>

      {!acceptsBookings ? (
        <p className="rounded-field bg-surface-1 px-3 py-2 text-sm text-ink-800">
          La réservation en ligne n&apos;est pas ouverte : contactez la compagnie avec les boutons ci-dessus.
        </p>
      ) : trip ? (
        <div className="space-y-3 rounded-card border border-border bg-card p-4">
          <div>
            <p className="text-sm font-semibold text-ink-900">Jour du voyage</p>
            {days.length ? (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {days.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={day === value}
                    onClick={() => {
                      setDay(value);
                      setTime(null);
                    }}
                    className={`min-h-11 shrink-0 rounded-pill border px-4 text-sm font-semibold first-letter:uppercase ${
                      day === value ? "border-ink-900 bg-ink-900 text-white" : "border-border text-ink-800"
                    }`}
                  >
                    {value === today ? "Aujourd'hui" : dayLabel(value)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm text-ink-600">Aucun départ à venir publié pour ce trajet.</p>
            )}
          </div>

          {day ? (
            <div>
              <p className="text-sm font-semibold text-ink-900">Heure de départ</p>
              {isFetching ? (
                <p className="mt-1 text-sm text-ink-600">Recherche des places…</p>
              ) : times.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {times.map(([value, seatsLeft]) => (
                    <button
                      key={value || "libre"}
                      type="button"
                      disabled={seatsLeft <= 0}
                      aria-pressed={time === value}
                      onClick={() => {
                        setTime(value);
                        setSeats((current) => Math.min(current, Math.max(1, seatsLeft)));
                      }}
                      className={`min-h-11 rounded-field border px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                        time === value ? "border-ink-900 bg-ink-900 text-white" : "border-border text-ink-800"
                      }`}
                    >
                      <span className="block font-semibold">{value || "Départ"}</span>
                      <span className={`block text-xs ${time === value ? "text-white/80" : seatsLeft <= 5 ? "font-semibold text-brand-700" : "text-ink-600"}`}>
                        {seatsLeft <= 0 ? "Complet" : `${seatsLeft} place${seatsLeft > 1 ? "s" : ""}`}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-sm text-ink-600">Plus de départ ce jour-là. Choisissez un autre jour.</p>
              )}
            </div>
          ) : null}

          {time !== null && left > 0 ? (
            <form onSubmit={submit} className="space-y-3 border-t border-border pt-3">
              <label className="block text-sm font-medium text-ink-800">
                Nombre de places
                <input
                  type="number"
                  min={1}
                  max={Math.min(left, 20)}
                  className={fieldClass}
                  value={seats}
                  onChange={(e) => setSeats(Math.min(Math.min(left, 20), Math.max(1, Number(e.target.value) || 1)))}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-ink-800">
                  Nom du voyageur
                  <input className={fieldClass} required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </label>
                <label className="block text-sm font-medium text-ink-800">
                  Téléphone
                  <input
                    className={fieldClass}
                    required
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </label>
              </div>
              <fieldset className="min-w-0">
                <legend className="text-sm font-medium text-ink-800">Paiement à la compagnie</legend>
                <div className="mt-1 flex gap-2">
                  {(["nita", "amana"] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      aria-pressed={form.method === method}
                      onClick={() => setForm({ ...form, method })}
                      className={`min-h-11 flex-1 rounded-field border px-4 text-sm font-semibold ${
                        form.method === method ? "border-ink-900 bg-ink-900 text-white" : "border-border bg-card text-ink-800"
                      }`}
                    >
                      {method === "nita" ? "Nita" : "Amana"}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink-600">
                  {payoutPhone
                    ? `Envoyez ${formatXOF(total)} au ${payoutPhone}, puis indiquez la référence. La compagnie confirme et votre billet apparaît.`
                    : "La compagnie vous indique comment payer en confirmant."}
                </p>
              </fieldset>
              <label className="block text-sm font-medium text-ink-800">
                Référence du paiement (si déjà payé)
                <input className={fieldClass} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
              </label>
              <p className="text-xs text-ink-600">
                En réservant, vous acceptez les{" "}
                <Link href="/legal/terms#reservations" className="font-semibold text-brand-700 hover:underline">
                  conditions de réservation
                </Link>{" "}
                : vous payez l&apos;établissement directement et ses conditions d&apos;annulation s&apos;appliquent.
              </p>
              <Button type="submit" size="lg" className="w-full" disabled={booking.isPending}>
                {booking.isPending ? "Envoi…" : `Réserver ${seats} place${seats > 1 ? "s" : ""} · ${formatXOF(total)}`}
              </Button>
            </form>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-ink-600">Choisissez un trajet.</p>
      )}

      {result ? (
        <p className={`flex items-start gap-2 text-sm ${result.ok ? "text-success" : "text-danger"}`} role="status">
          {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : null}
          <span>
            {result.text}{" "}
            {result.ok ? (
              <Link href="/dashboard#reservations" className="font-semibold underline">
                Mes réservations
              </Link>
            ) : result.text.toLowerCase().includes("connect") ? (
              <Link href="/login" className="font-semibold underline">
                Se connecter
              </Link>
            ) : null}
          </span>
        </p>
      ) : null}
    </section>
  );
}
