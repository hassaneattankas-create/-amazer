"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { BedDouble, Bus, CalendarClock } from "lucide-react";

import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { cancelMyBooking, getTripSeats, listMyBookings, rescheduleMyBooking } from "@/services/seller-service";
import type { HotelBookingStatus, MyBooking } from "@/types/seller";

const STATUS: Record<HotelBookingStatus, { label: string; className: string }> = {
  pending: { label: "En attente de confirmation", className: "bg-warning/25 text-ink-900" },
  confirmed: { label: "Confirmée", className: "bg-success/20 text-ink-900" },
  checked_in: { label: "En cours", className: "bg-info/15 text-ink-900" },
  checked_out: { label: "Terminée", className: "bg-surface-2 text-ink-700" },
  cancelled: { label: "Annulée", className: "bg-danger/10 text-danger" },
  no_show: { label: "Non présentée", className: "bg-surface-2 text-ink-700" },
};

function dayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function isoDay(offset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Billet de bus : changer de départ (même trajet, places vérifiées) ou annuler, jusqu'à 2 h avant le départ. */
function TripChanger({ booking }: { booking: MyBooking }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"idle" | "move" | "cancel">("idle");
  const [day, setDay] = useState(isoDay(1));
  const [time, setTime] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const seats = useQuery({
    queryKey: ["trip-seats", booking.vendor_id, booking.trip_id, day],
    queryFn: () => getTripSeats(booking.vendor_id, booking.trip_id ?? "", day),
    enabled: mode === "move" && Boolean(booking.trip_id && day),
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
  const move = useMutation({
    mutationFn: () => rescheduleMyBooking(booking.id, day, time),
    onSuccess: () => {
      setMode("idle");
      setMessage({ ok: true, text: "Billet reporté. La compagnie est prévenue ; votre QR code reste le même." });
      refresh();
    },
    onError: (error) => setMessage({ ok: false, text: getApiErrorMessage(error, "Report impossible. Choisissez un autre départ.") }),
  });
  const cancel = useMutation({
    mutationFn: () => cancelMyBooking(booking.id),
    onSuccess: () => {
      setMode("idle");
      setMessage({ ok: true, text: "Billet annulé. Pour un remboursement, contactez la compagnie." });
      refresh();
    },
    onError: (error) => setMessage({ ok: false, text: getApiErrorMessage(error, "Annulation impossible.") }),
  });
  const times = Object.entries(seats.data?.seats_left ?? {});
  const needsTime = times.some(([value]) => Boolean(value));

  return (
    <div className="space-y-2">
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setMode("move");
            }}
            className="inline-flex min-h-11 items-center rounded-field border border-border px-4 text-sm font-semibold text-ink-900 hover:border-ink-400"
          >
            Changer la date
          </button>
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setMode("cancel");
            }}
            className="inline-flex min-h-11 items-center rounded-field px-3 text-sm font-semibold text-danger hover:underline"
          >
            Annuler le billet
          </button>
        </div>
      ) : null}
      {mode === "move" ? (
        <div className="space-y-2 rounded-field border border-border p-3">
          <label className="block text-sm font-medium text-ink-800">
            Nouveau jour
            <input
              type="date"
              min={isoDay(0)}
              value={day}
              onChange={(event) => {
                setDay(event.target.value);
                setTime(null);
              }}
              className="mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900"
            />
          </label>
          {seats.isFetching ? <p className="text-sm text-ink-600">Places restantes…</p> : null}
          {!seats.isFetching && times.length === 0 ? <p className="text-sm text-ink-600">Pas de départ ce jour-là. Essayez un autre jour.</p> : null}
          <div className="flex flex-wrap gap-2">
            {times.map(([value, left]) => {
              const enough = left >= booking.guest_count;
              const selected = time === (value || null);
              return (
                <button
                  key={value || "jour"}
                  type="button"
                  disabled={!enough}
                  aria-pressed={selected}
                  onClick={() => setTime(value || null)}
                  className={`min-h-11 rounded-pill border px-3 text-sm font-semibold disabled:opacity-50 ${
                    selected ? "border-brand-600 bg-brand-600 text-white" : "border-border text-ink-900"
                  }`}
                >
                  {value || "Départ"} · {enough ? `${left} place${left > 1 ? "s" : ""}` : "complet"}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={move.isPending || times.length === 0 || (needsTime && !time)}
              onClick={() => move.mutate()}
              className="inline-flex min-h-11 items-center rounded-field bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {move.isPending ? "Report…" : "Confirmer le report"}
            </button>
            <button type="button" onClick={() => setMode("idle")} className="min-h-11 px-3 text-sm font-semibold text-ink-700 hover:underline">
              Retour
            </button>
          </div>
        </div>
      ) : null}
      {mode === "cancel" ? (
        <div className="space-y-2 rounded-field border border-danger/30 bg-danger/5 p-3">
          <p className="text-sm text-ink-900">Annuler ce billet ? La place sera libérée. Le remboursement dépend des conditions de la compagnie.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate()}
              className="inline-flex min-h-11 items-center rounded-field bg-danger px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {cancel.isPending ? "Annulation…" : "Oui, annuler"}
            </button>
            <button type="button" onClick={() => setMode("idle")} className="min-h-11 px-3 text-sm font-semibold text-ink-700 hover:underline">
              Garder mon billet
            </button>
          </div>
        </div>
      ) : null}
      {message ? (
        <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-success" : "text-danger"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}

/** Reservations du client (hotels et trajets) ; billet a QR code a montrer a l'embarquement. */
export function MyBookings() {
  const [ticketFor, setTicketFor] = useState<string | null>(null);
  const { data = [], isPending } = useQuery({ queryKey: ["my-bookings"], queryFn: listMyBookings, refetchInterval: 60_000 });
  if (isPending || !Array.isArray(data) || !data.length) return null;

  return (
    <article id="reservations" className="scroll-mt-24 rounded-card border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
        <CalendarClock className="h-5 w-5 text-brand-600" aria-hidden="true" />
        Mes réservations
      </h2>
      <ul className="mt-3 divide-y divide-border">
        {data.map((booking: MyBooking) => (
          <li key={booking.id} className="space-y-2 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold text-ink-900">
                  {booking.kind === "transport" ? <Bus className="h-4 w-4" aria-hidden="true" /> : <BedDouble className="h-4 w-4" aria-hidden="true" />}
                  {booking.place_name}
                </p>
                <p className="text-sm text-ink-700">
                  {booking.item_name} ·{" "}
                  {booking.kind === "transport"
                    ? `${dayLabel(booking.check_in_date)}${booking.departure_time ? ` à ${booking.departure_time}` : ""} · ${booking.guest_count} place${booking.guest_count > 1 ? "s" : ""}`
                    : `${dayLabel(booking.check_in_date)} → ${dayLabel(booking.check_out_date)}`}
                </p>
                <p className="text-sm font-semibold text-ink-900">{formatXOF(booking.amount)}</p>
              </div>
              <span className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${STATUS[booking.status].className}`}>{STATUS[booking.status].label}</span>
            </div>
            {booking.ticket_token ? (
              ticketFor === booking.id ? (
                <div className="flex flex-col items-center gap-2 rounded-field border border-border p-4">
                  <QRCodeSVG value={booking.ticket_token} size={200} level="M" marginSize={2} aria-label="QR code du billet" />
                  <p className="text-center text-sm text-ink-700">Montrez ce QR code au chauffeur à l&apos;embarquement.</p>
                  <button type="button" className="min-h-11 text-sm font-semibold text-brand-700 hover:underline" onClick={() => setTicketFor(null)}>
                    Masquer le billet
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setTicketFor(booking.id)}
                  className="inline-flex min-h-11 items-center rounded-field bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-ink-800"
                >
                  Afficher mon billet
                </button>
              )
            ) : null}
            {booking.kind === "transport" && booking.can_change ? <TripChanger booking={booking} /> : null}
          </li>
        ))}
      </ul>
    </article>
  );
}
