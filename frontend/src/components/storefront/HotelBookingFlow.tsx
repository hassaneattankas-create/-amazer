"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BedDouble, CheckCircle2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { resolveImageUrl } from "@/lib/image";
import { createHotelBooking, getRoomAvailability } from "@/services/seller-service";
import type { HotelRoomType } from "@/types/seller";

const fieldClass = "mt-1 h-11 w-full rounded-field border border-border bg-card px-3 text-sm text-ink-900";

function isoDay(offset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function nightsBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
}

/** Reservation d'hotel (modele Booking.com) : dates -> chambres libres -> coordonnees -> demande envoyee. */
export function HotelBookingFlow({
  vendorId,
  hotelName,
  rooms,
  acceptsBookings,
  payoutPhone,
}: {
  vendorId: string;
  hotelName: string;
  rooms: HotelRoomType[];
  acceptsBookings: boolean;
  payoutPhone: string | null | undefined;
}) {
  const [checkIn, setCheckIn] = useState(isoDay(0));
  const [checkOut, setCheckOut] = useState(isoDay(1));
  const [guests, setGuests] = useState(1);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", request: "", method: "nita" as "nita" | "amana", reference: "" });
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const nights = nightsBetween(checkIn, checkOut);
  const datesValid = nights > 0 && nights <= 60 && checkIn >= isoDay(0);

  const { data: availability, isFetching, error: availabilityError } = useQuery({
    queryKey: ["room-availability", vendorId, checkIn, checkOut],
    queryFn: () => getRoomAvailability(vendorId, checkIn, checkOut),
    enabled: acceptsBookings && datesValid,
    staleTime: 30_000,
  });
  const room = rooms.find((item) => item.id === roomId) ?? null;
  const total = room ? room.night_price * nights : 0;

  const booking = useMutation({
    mutationFn: () =>
      createHotelBooking(vendorId, {
        vendor_id: vendorId,
        room_type_id: roomId ?? "",
        guest_name: form.name.trim(),
        guest_phone: form.phone.trim(),
        guest_email: form.email.trim() || undefined,
        check_in_date: checkIn,
        check_out_date: checkOut,
        guest_count: guests,
        deposit_payment_method: form.method,
        transaction_reference: form.reference.trim() || undefined,
        special_request: form.request.trim() || undefined,
      }),
    onSuccess: () => {
      setResult({ ok: true, text: `Demande envoyée à ${hotelName}. Vous recevez une notification dès qu'elle est confirmée.` });
      setRoomId(null);
    },
    onError: (error) => setResult({ ok: false, text: getApiErrorMessage(error, "Réservation impossible. Connectez-vous puis réessayez.") }),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResult(null);
    booking.mutate();
  };

  if (!rooms.length) {
    return <p className="rounded-card border border-border bg-card p-6 text-sm text-ink-600">Cet établissement n&apos;a pas encore publié ses chambres.</p>;
  }

  return (
    <section aria-labelledby="rooms-title" className="space-y-4">
      <h2 id="rooms-title" className="flex items-center gap-2 text-xl font-semibold text-ink-900">
        <BedDouble className="h-5 w-5 text-brand-600" aria-hidden="true" />
        Chambres
      </h2>

      {acceptsBookings ? (
        <div className="grid grid-cols-2 gap-2 rounded-card border border-border bg-card p-3 sm:grid-cols-[1fr_1fr_8rem]">
          <label className="block text-sm font-medium text-ink-800">
            Arrivée
            <input
              type="date"
              className={fieldClass}
              min={isoDay(0)}
              value={checkIn}
              onChange={(e) => {
                setCheckIn(e.target.value);
                if (e.target.value >= checkOut) {
                  const next = new Date(e.target.value);
                  next.setDate(next.getDate() + 1);
                  setCheckOut(next.toISOString().slice(0, 10));
                }
              }}
            />
          </label>
          <label className="block text-sm font-medium text-ink-800">
            Départ
            <input type="date" className={fieldClass} min={checkIn} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </label>
          <label className="col-span-2 block text-sm font-medium text-ink-800 sm:col-span-1">
            Personnes
            <input
              type="number"
              min={1}
              max={12}
              className={fieldClass}
              value={guests}
              onChange={(e) => setGuests(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
            />
          </label>
          <p className="col-span-2 text-sm text-ink-700 sm:col-span-3" aria-live="polite">
            {datesValid ? `${nights} nuit${nights > 1 ? "s" : ""}` : "Choisissez une date de départ après l'arrivée (60 nuits au plus)."}
            {isFetching ? " · recherche des chambres libres…" : ""}
            {availabilityError ? ` · ${getApiErrorMessage(availabilityError, "Disponibilités indisponibles.")}` : ""}
          </p>
        </div>
      ) : (
        <p className="rounded-field bg-surface-1 px-3 py-2 text-sm text-ink-800">
          La réservation en ligne n&apos;est pas ouverte : contactez l&apos;établissement avec les boutons ci-dessus.
        </p>
      )}

      <ul className="grid gap-3 md:grid-cols-2">
        {rooms.map((item) => {
          const id = String(item.id ?? item.name);
          const free = availability?.available[id];
          const tooSmall = guests > item.capacity;
          const full = acceptsBookings && datesValid && free === 0;
          const photo = item.photo_urls?.[0];
          return (
            <li key={id} className={`overflow-hidden rounded-card border bg-card ${roomId === id ? "border-brand-600" : "border-border"}`}>
              <div className="aspect-[16/9] bg-surface-1">
                {photo ? (
                  <Image
                    src={resolveImageUrl(photo) ?? "/images/placeholders/default.svg"}
                    alt={item.name}
                    width={640}
                    height={360}
                    sizes="(max-width: 768px) 100vw, 50vw"
                    unoptimized
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-ink-400">
                    <BedDouble className="h-8 w-8" aria-hidden="true" />
                  </span>
                )}
              </div>
              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-ink-900">{item.name}</h3>
                  <p className="shrink-0 text-right">
                    <span className="block font-bold text-ink-900">{formatXOF(item.night_price)}</span>
                    <span className="text-xs text-ink-600">par nuit</span>
                  </p>
                </div>
                {item.description ? <p className="text-sm text-ink-700">{item.description}</p> : null}
                <p className="flex items-center gap-1 text-sm text-ink-700">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  {item.capacity} personne{item.capacity > 1 ? "s" : ""} max.
                </p>
                {item.amenities.length ? (
                  <ul className="flex flex-wrap gap-1">
                    {item.amenities.map((amenity) => (
                      <li key={amenity} className="rounded-pill bg-surface-1 px-2 py-0.5 text-xs text-ink-800">
                        {amenity}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {acceptsBookings && datesValid ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                    <p className="text-sm">
                      {full ? (
                        <span className="font-semibold text-danger">Complet pour ces dates</span>
                      ) : (
                        <>
                          <span className="font-semibold text-ink-900">{formatXOF(item.night_price * nights)}</span>
                          <span className="text-ink-600"> pour {nights} nuit{nights > 1 ? "s" : ""}</span>
                          {typeof free === "number" && free <= 2 ? (
                            <span className="block text-xs font-semibold text-brand-700">
                              Plus que {free} chambre{free > 1 ? "s" : ""}
                            </span>
                          ) : null}
                        </>
                      )}
                    </p>
                    <Button
                      type="button"
                      disabled={full || tooSmall || free === undefined}
                      variant={roomId === id ? "default" : "outline"}
                      onClick={() => {
                        setResult(null);
                        setRoomId(id);
                      }}
                    >
                      {tooSmall ? "Trop petite" : roomId === id ? "Choisie" : "Choisir"}
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {room && acceptsBookings ? (
        <form onSubmit={submit} className="space-y-3 rounded-card border border-border bg-card p-4">
          <p className="font-semibold text-ink-900">
            {room.name} · {nights} nuit{nights > 1 ? "s" : ""} · {formatXOF(total)}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-ink-800">
              Nom complet
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
            <label className="block text-sm font-medium text-ink-800 sm:col-span-2">
              Demande particulière (facultatif)
              <input
                className={fieldClass}
                value={form.request}
                onChange={(e) => setForm({ ...form, request: e.target.value })}
                placeholder="Arrivée tardive, lit bébé…"
              />
            </label>
          </div>
          <fieldset className="min-w-0">
            <legend className="text-sm font-medium text-ink-800">Paiement à l&apos;établissement</legend>
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
                ? `Envoyez ${formatXOF(total)} au ${payoutPhone}, puis indiquez la référence. L'hôtel confirme après vérification.`
                : "L'hôtel vous indique comment payer en confirmant la réservation."}
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
            {booking.isPending ? "Envoi…" : `Demander la réservation · ${formatXOF(total)}`}
          </Button>
        </form>
      ) : null}

      {result ? (
        <p className={`flex items-start gap-2 text-sm ${result.ok ? "text-success" : "text-danger"}`} role="status">
          {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : null}
          {result.text}
          {!result.ok && result.text.toLowerCase().includes("connect") ? (
            <Link href="/login" className="ml-1 font-semibold underline">
              Se connecter
            </Link>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
