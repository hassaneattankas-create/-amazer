"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BedDouble, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { updateSellerHotelBookingStatus } from "@/services/seller-service";
import type { HotelBooking, HotelBookingStatus, HotelRoomType } from "@/types/seller";

type View = "arrivees" | "confirmer" | "sejour" | "avenir" | "historique";

const STATUS_LABEL: Record<HotelBookingStatus, string> = {
  pending: "À confirmer",
  confirmed: "Confirmée",
  checked_in: "En séjour",
  checked_out: "Partie",
  cancelled: "Annulée",
  no_show: "Absent",
};

/** Date du jour au format AAAA-MM-JJ (heure locale du telephone). */
function todayIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function nights(booking: HotelBooking): number {
  return Math.max(1, Math.round((new Date(booking.check_out_date).getTime() - new Date(booking.check_in_date).getTime()) / 86400000));
}

/** Chiffres du jour : arrivees, departs, occupation de la nuit, demandes a confirmer. */
export function HotelKpis({ bookings, rooms }: { bookings: HotelBooking[]; rooms: HotelRoomType[] }) {
  const today = todayIso();
  const holding = bookings.filter((b) => ["confirmed", "checked_in"].includes(b.status));
  const totalRooms = rooms.reduce((sum, room) => sum + Math.max(1, room.room_count ?? 1), 0);
  const tonight = holding.filter((b) => b.check_in_date <= today && today < b.check_out_date).length;
  const stats = [
    { label: "Arrivées aujourd'hui", value: String(holding.filter((b) => b.check_in_date === today && b.status === "confirmed").length) },
    { label: "Départs aujourd'hui", value: String(bookings.filter((b) => b.check_out_date === today && b.status === "checked_in").length) },
    { label: "Occupation cette nuit", value: totalRooms ? `${Math.round((tonight / totalRooms) * 100)} %` : "—" },
    { label: "À confirmer", value: String(bookings.filter((b) => b.status === "pending").length), alert: bookings.some((b) => b.status === "pending") },
  ];
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className={`rounded-card border bg-card p-3 ${stat.alert ? "border-brand-500" : "border-border"}`}>
          <dt className="text-xs text-ink-600">{stat.label}</dt>
          <dd className="mt-1 text-xl font-bold text-ink-900">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Reception de l'hotel (modele Booking / Extranet) : une liste par moment de la journee, une action par carte. */
export function HotelFrontDesk({ bookings }: { bookings: HotelBooking[] }) {
  const queryClient = useQueryClient();
  const [chosen, setChosen] = useState<View | null>(null);
  const [error, setError] = useState("");
  const today = todayIso();
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: HotelBookingStatus }) => updateSellerHotelBookingStatus(id, status),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["seller-hotel-bookings"] });
    },
    onError: (err) => setError(getApiErrorMessage(err, "Action impossible. Réessayez.")),
  });

  const lists: Record<View, HotelBooking[]> = {
    arrivees: bookings.filter((b) => b.status === "confirmed" && b.check_in_date <= today),
    confirmer: bookings.filter((b) => b.status === "pending"),
    sejour: bookings.filter((b) => b.status === "checked_in"),
    avenir: bookings.filter((b) => b.status === "confirmed" && b.check_in_date > today),
    historique: bookings.filter((b) => ["checked_out", "cancelled", "no_show"].includes(b.status)),
  };
  const tabs: Array<{ key: View; label: string }> = [
    { key: "arrivees", label: "Arrivées" },
    { key: "confirmer", label: "À confirmer" },
    { key: "sejour", label: "En séjour" },
    { key: "avenir", label: "À venir" },
    { key: "historique", label: "Historique" },
  ];
  const auto: View = lists.confirmer.length ? "confirmer" : lists.arrivees.length ? "arrivees" : lists.sejour.length ? "sejour" : "avenir";
  const view = chosen ?? auto;
  const visible = [...lists[view]].sort((a, b) =>
    view === "historique" ? b.check_in_date.localeCompare(a.check_in_date) : a.check_in_date.localeCompare(b.check_in_date)
  );

  const act = (id: string, status: HotelBookingStatus, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    mutation.mutate({ id, status });
  };

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
        <BedDouble className="h-5 w-5 text-brand-600" aria-hidden="true" />
        Réservations
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Réservations">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={view === tab.key}
            onClick={() => setChosen(tab.key)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-pill px-4 text-sm font-semibold ${
              view === tab.key ? "bg-ink-900 text-white" : "border border-border text-ink-800 hover:bg-surface-1"
            }`}
          >
            {tab.label}
            <span className={view === tab.key ? "text-white/70" : "text-ink-500"}>{lists[tab.key].length}</span>
          </button>
        ))}
      </div>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {visible.length ? (
        <ul className="space-y-3">
          {visible.map((booking) => {
            const room = String(booking.room_snapshot?.name ?? "Chambre");
            const late = booking.status === "confirmed" && booking.check_in_date < today;
            return (
              <li key={booking.id} className={`rounded-card border bg-card p-4 ${late ? "border-warning" : "border-border"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900">{booking.guest_name}</p>
                    <p className="text-sm text-ink-700">
                      {room} · {booking.guest_count} pers. · {nights(booking)} nuit{nights(booking) > 1 ? "s" : ""}
                    </p>
                    <p className="text-sm text-ink-700">
                      {shortDate(booking.check_in_date)} → {shortDate(booking.check_out_date)}
                      {late ? <span className="ml-1 font-semibold text-ink-900">· arrivée prévue avant aujourd&apos;hui</span> : null}
                    </p>
                    {booking.special_request ? <p className="text-xs text-ink-600">Demande : {booking.special_request}</p> : null}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-ink-900">{formatXOF(booking.deposit_amount)}</p>
                    <p className="text-xs text-ink-600">
                      {booking.payment_status === "paid" ? "Payé" : "Paiement à vérifier"}
                      {booking.transaction_reference ? ` · réf. ${booking.transaction_reference}` : ""}
                    </p>
                    {view === "historique" ? <p className="text-xs font-semibold text-ink-800">{STATUS_LABEL[booking.status]}</p> : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {booking.status === "pending" ? (
                    <>
                      <Button type="button" disabled={mutation.isPending} onClick={() => act(booking.id, "confirmed")}>
                        Confirmer
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={mutation.isPending}
                        onClick={() => act(booking.id, "cancelled", "Refuser cette réservation ? Le client est prévenu.")}
                      >
                        Refuser
                      </Button>
                    </>
                  ) : null}
                  {booking.status === "confirmed" ? (
                    <>
                      <Button type="button" disabled={mutation.isPending} onClick={() => act(booking.id, "checked_in")}>
                        Client arrivé
                      </Button>
                      {booking.check_in_date <= today ? (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={mutation.isPending}
                          onClick={() => act(booking.id, "no_show", "Marquer le client absent ? La chambre est libérée.")}
                        >
                          Absent
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        disabled={mutation.isPending}
                        onClick={() => act(booking.id, "cancelled", "Annuler cette réservation ? Le client est prévenu.")}
                      >
                        Annuler
                      </Button>
                    </>
                  ) : null}
                  {booking.status === "checked_in" ? (
                    <Button type="button" disabled={mutation.isPending} onClick={() => act(booking.id, "checked_out")}>
                      Client parti
                    </Button>
                  ) : null}
                  <a
                    href={`tel:${booking.guest_phone}`}
                    className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-field border border-border px-3 text-sm font-medium text-ink-800 hover:bg-surface-1"
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    Appeler
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-card border border-border bg-card p-6 text-center text-sm text-ink-600">
          {view === "confirmer" ? "Aucune demande à confirmer." : view === "arrivees" ? "Aucune arrivée prévue aujourd'hui." : "Rien ici pour le moment."}
        </p>
      )}
    </div>
  );
}
