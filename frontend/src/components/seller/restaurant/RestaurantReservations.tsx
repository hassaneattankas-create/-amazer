"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { updateSellerRestaurantReservationStatus } from "@/services/restaurant-service";
import type { RestaurantReservation } from "@/types/restaurant";

const STATUS: Record<RestaurantReservation["status"], { label: string; className: string }> = {
  pending: { label: "À confirmer", className: "bg-warning/25 text-ink-900" },
  confirmed: { label: "Confirmée", className: "bg-success/20 text-ink-900" },
  declined: { label: "Refusée", className: "bg-danger/10 text-danger" },
};

function when(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Reservations de tables : a confirmer en premier, puis par date. */
export function RestaurantReservations({ reservations }: { reservations: RestaurantReservation[] }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "confirmed" | "declined" }) => updateSellerRestaurantReservationStatus(id, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["seller-restaurant-reservations"] }),
  });
  const sorted = [...reservations].sort(
    (a, b) => Number(b.status === "pending") - Number(a.status === "pending") || a.reservation_at.localeCompare(b.reservation_at)
  );
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
        <CalendarClock className="h-5 w-5 text-brand-600" aria-hidden="true" />
        Réservations de tables
      </h2>
      {sorted.length ? (
        <ul className="divide-y divide-border rounded-card border border-border bg-card">
          {sorted.map((reservation) => (
            <li key={reservation.id} className="space-y-2 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink-900">
                    {when(reservation.reservation_at)} · {reservation.guest_count} pers.
                  </p>
                  <p className="text-sm text-ink-700">{reservation.customer_name}</p>
                  {reservation.note ? <p className="text-xs text-ink-600">Note : {reservation.note}</p> : null}
                </div>
                <span className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${STATUS[reservation.status].className}`}>
                  {STATUS[reservation.status].label}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {reservation.status !== "confirmed" ? (
                  <Button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: reservation.id, status: "confirmed" })}>
                    Confirmer
                  </Button>
                ) : null}
                {reservation.status !== "declined" ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ id: reservation.id, status: "declined" })}
                  >
                    Refuser
                  </Button>
                ) : null}
                <a
                  href={`tel:${reservation.customer_phone}`}
                  className="inline-flex min-h-11 items-center gap-1 rounded-field border border-border px-3 text-sm font-medium text-ink-800 hover:bg-surface-1"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Appeler
                </a>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-card border border-border bg-card p-6 text-center text-sm text-ink-600">Aucune réservation pour le moment.</p>
      )}
    </div>
  );
}
