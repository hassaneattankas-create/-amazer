"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { BedDouble, Bus, CalendarClock } from "lucide-react";

import { formatXOF } from "@/lib/currency";
import { listMyBookings } from "@/services/seller-service";
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

/** Reservations du client (hotels et trajets) ; billet a QR code a montrer a l'embarquement. */
export function MyBookings() {
  const [ticketFor, setTicketFor] = useState<string | null>(null);
  const { data = [], isPending } = useQuery({ queryKey: ["my-bookings"], queryFn: listMyBookings, refetchInterval: 60_000 });
  if (isPending || !data.length) return null;

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
          </li>
        ))}
      </ul>
    </article>
  );
}
