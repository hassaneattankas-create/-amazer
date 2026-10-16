"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bus, Phone } from "lucide-react";

import { BarcodeScannerDrawer } from "@/components/BarcodeScannerDrawer";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { scanTicket, updateSellerHotelBookingStatus } from "@/services/seller-service";
import type { HotelBooking, HotelBookingStatus, HotelRoomType } from "@/types/seller";

const LIVE: HotelBookingStatus[] = ["pending", "confirmed", "checked_in"];
const STATUS_LABEL: Record<HotelBookingStatus, string> = {
  pending: "À confirmer",
  confirmed: "Confirmé",
  checked_in: "Embarqué",
  checked_out: "Arrivé",
  cancelled: "Annulé",
  no_show: "Absent",
};

function todayIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function dayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/** Poste d'embarquement : departs (jour + heure) avec places vendues, passagers, scan des billets. */
export function TransportDesk({ bookings, trips }: { bookings: HotelBooking[]; trips: HotelRoomType[] }) {
  const queryClient = useQueryClient();
  const [showPast, setShowPast] = useState(false);
  const [scanResult, setScanResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [error, setError] = useState("");
  const today = todayIso();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["seller-hotel-bookings"] });

  const status = useMutation({
    mutationFn: ({ id, next }: { id: string; next: HotelBookingStatus }) => updateSellerHotelBookingStatus(id, next),
    onSuccess: () => {
      setError("");
      refresh();
    },
    onError: (err) => setError(getApiErrorMessage(err, "Action impossible.")),
  });
  const scan = useMutation({
    mutationFn: scanTicket,
    onSuccess: (result) => {
      setScanResult({ ok: result.ok, text: result.message });
      refresh();
    },
    onError: (err) => setScanResult({ ok: false, text: getApiErrorMessage(err, "Scan impossible.") }),
  });

  const capacity = (tripId: string) => Math.max(1, trips.find((trip) => String(trip.id) === tripId)?.capacity ?? 1);
  const departures = useMemo(() => {
    const map = new Map<string, HotelBooking[]>();
    for (const booking of bookings) {
      if (!showPast && booking.check_in_date < today) continue;
      const key = `${booking.check_in_date}|${booking.departure_time ?? ""}|${booking.room_type_id}`;
      map.set(key, [...(map.get(key) ?? []), booking]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => (showPast ? b.localeCompare(a) : a.localeCompare(b)));
  }, [bookings, showPast, today]);
  const pending = bookings.filter((booking) => booking.status === "pending").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
          <Bus className="h-5 w-5 text-brand-600" aria-hidden="true" />
          Départs et passagers
        </h2>
        <BarcodeScannerDrawer
          mode="qr"
          triggerLabel="Scanner un billet"
          triggerClassName="inline-flex min-h-11 items-center gap-2 rounded-field bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-ink-800"
          onDetected={(value) => {
            setScanResult(null);
            const token = value.includes("ticket=") ? new URL(value, "https://amazer.store").searchParams.get("ticket") ?? value : value;
            scan.mutate(token);
          }}
        />
      </div>
      {pending ? <p className="text-sm font-semibold text-ink-900">{pending} réservation{pending > 1 ? "s" : ""} à confirmer.</p> : null}
      {scanResult ? (
        <p
          role="status"
          className={`rounded-field px-3 py-3 text-base font-semibold ${scanResult.ok ? "bg-success/20 text-ink-900" : "bg-danger/10 text-danger"}`}
        >
          {scanResult.ok ? "✓ " : "✕ "}
          {scanResult.text}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {departures.length ? (
        departures.map(([key, list]) => {
          const [day, time, tripId] = key.split("|");
          const sold = list.filter((b) => LIVE.includes(b.status)).reduce((sum, b) => sum + b.guest_count, 0);
          const boarded = list.filter((b) => b.status === "checked_in").reduce((sum, b) => sum + b.guest_count, 0);
          const tripName = String(list[0]?.room_snapshot?.name ?? "Trajet");
          return (
            <article key={key} className="rounded-card border border-border bg-card">
              <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border p-3">
                <div>
                  <p className="font-semibold text-ink-900">
                    {tripName}
                    {time ? ` · ${time}` : ""}
                  </p>
                  <p className="text-sm text-ink-700 first-letter:uppercase">{day === today ? "Aujourd'hui" : dayLabel(day)}</p>
                </div>
                <p className="text-right text-sm">
                  <span className="block font-bold text-ink-900">
                    {sold}/{capacity(tripId)} places
                  </span>
                  <span className="text-ink-600">{boarded} embarqué{boarded > 1 ? "s" : ""}</span>
                </p>
              </header>
              <ul className="divide-y divide-border">
                {list.map((booking) => (
                  <li key={booking.id} className="flex flex-wrap items-center gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink-900">
                        {booking.guest_name} · {booking.guest_count} place{booking.guest_count > 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-ink-600">
                        {STATUS_LABEL[booking.status]} · {formatXOF(booking.deposit_amount)}
                        {booking.payment_status === "paid" ? " payé" : " à vérifier"}
                        {booking.transaction_reference ? ` · réf. ${booking.transaction_reference}` : ""}
                      </p>
                    </div>
                    {booking.status === "pending" ? (
                      <>
                        <Button type="button" size="sm" disabled={status.isPending} onClick={() => status.mutate({ id: booking.id, next: "confirmed" })}>
                          Confirmer
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={status.isPending}
                          onClick={() => window.confirm("Refuser cette réservation ?") && status.mutate({ id: booking.id, next: "cancelled" })}
                        >
                          Refuser
                        </Button>
                      </>
                    ) : null}
                    {booking.status === "confirmed" ? (
                      <>
                        <Button type="button" size="sm" disabled={status.isPending} onClick={() => status.mutate({ id: booking.id, next: "checked_in" })}>
                          Embarqué
                        </Button>
                        {day <= today ? (
                          <Button type="button" size="sm" variant="outline" disabled={status.isPending} onClick={() => status.mutate({ id: booking.id, next: "no_show" })}>
                            Absent
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                    <a
                      href={`tel:${booking.guest_phone}`}
                      aria-label={`Appeler ${booking.guest_name}`}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-field border border-border text-ink-800 hover:bg-surface-1"
                    >
                      <Phone className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </article>
          );
        })
      ) : (
        <p className="rounded-card border border-border bg-card p-6 text-center text-sm text-ink-600">Aucune réservation à venir.</p>
      )}
      <button type="button" className="min-h-11 text-sm font-semibold text-brand-700 hover:underline" onClick={() => setShowPast((v) => !v)}>
        {showPast ? "Voir les départs à venir" : "Voir les départs passés"}
      </button>
    </div>
  );
}
