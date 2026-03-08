"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BedDouble, Flame, Hotel, Images, Search, ShieldCheck, Store, UtensilsCrossed } from "lucide-react";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatXOF } from "@/lib/currency";
import { resolveImageUrl } from "@/lib/image";
import { createRestaurantReservation } from "@/services/restaurant-service";
import { createHotelBooking, getSellerStorefront } from "@/services/seller-service";
import type { HotelRoomType, SellerStorefront, SellerStorefrontProduct } from "@/types/seller";
import type { RestaurantMenuItem } from "@/types/restaurant";

const activityLabels = {
  shop: "Boutique",
  restaurant: "Restaurant",
  hotel: "Hotel",
  enterprise: "Entreprise",
} as const;

export default function VendorShopPage() {
  const params = useParams<{ vendorId: string }>();
  const vendorId = params.vendorId;
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [reservationForm, setReservationForm] = useState({
    customer_name: "",
    customer_phone: "",
    reservation_at: "",
    guest_count: "2",
    note: "",
  });
  const [hotelForm, setHotelForm] = useState({
    room_type_id: "",
    guest_name: "",
    guest_phone: "",
    guest_email: "",
    check_in_date: "",
    check_out_date: "",
    guest_count: "1",
    deposit_payment_method: "nita" as "nita" | "amana",
    transaction_reference: "",
    special_request: "",
  });

  const { data, isPending, isError } = useQuery({
    queryKey: ["seller-storefront", vendorId],
    queryFn: () => getSellerStorefront(vendorId),
    enabled: Boolean(vendorId),
  });

  const reservationMutation = useMutation({
    mutationFn: () =>
      createRestaurantReservation(vendorId, {
        vendor_id: vendorId,
        customer_name: reservationForm.customer_name,
        customer_phone: reservationForm.customer_phone,
        reservation_at: reservationForm.reservation_at,
        guest_count: Number(reservationForm.guest_count || 2),
        note: reservationForm.note || undefined,
      }),
    onSuccess: () => {
      setStatus("Reservation de table envoyee au restaurateur.");
      setReservationForm({
        customer_name: "",
        customer_phone: "",
        reservation_at: "",
        guest_count: "2",
        note: "",
      });
      queryClient.invalidateQueries({ queryKey: ["seller-storefront", vendorId] });
    },
    onError: () => setStatus("Impossible d'envoyer la reservation de table."),
  });

  const hotelBookingMutation = useMutation({
    mutationFn: () =>
      createHotelBooking(vendorId, {
        vendor_id: vendorId,
        room_type_id: hotelForm.room_type_id,
        guest_name: hotelForm.guest_name,
        guest_phone: hotelForm.guest_phone,
        guest_email: hotelForm.guest_email || undefined,
        check_in_date: hotelForm.check_in_date,
        check_out_date: hotelForm.check_out_date,
        guest_count: Number(hotelForm.guest_count || 1),
        deposit_payment_method: hotelForm.deposit_payment_method,
        transaction_reference: hotelForm.transaction_reference || undefined,
        special_request: hotelForm.special_request || undefined,
      }),
    onSuccess: () => {
      setStatus("Demande de reservation hotel envoyee.");
      setHotelForm((prev) => ({
        ...prev,
        guest_name: "",
        guest_phone: "",
        guest_email: "",
        check_in_date: "",
        check_out_date: "",
        guest_count: "1",
        transaction_reference: "",
        special_request: "",
      }));
    },
    onError: () => setStatus("Impossible d'envoyer la reservation hotel."),
  });

  const normalizedQuery = query.trim().toLowerCase();
  const filteredProducts = useMemo(() => {
    if (!data || !data.products.length) return [];
    if (!normalizedQuery) return data.products;
    return data.products.filter((item) => `${item.name} ${item.brand}`.toLowerCase().includes(normalizedQuery));
  }, [data, normalizedQuery]);
  const filteredMenu = useMemo(() => {
    if (!data || !data.restaurant_menu.length) return [];
    if (!normalizedQuery) return data.restaurant_menu;
    return data.restaurant_menu.filter((item) =>
      `${item.name} ${item.description || ""} ${(item.tags || []).join(" ")}`.toLowerCase().includes(normalizedQuery)
    );
  }, [data, normalizedQuery]);
  const filteredRooms = useMemo(() => {
    if (!data || !data.room_types.length) return [];
    if (!normalizedQuery) return data.room_types;
    return data.room_types.filter((item) =>
      `${item.name} ${item.description || ""} ${(item.amenities || []).join(" ")}`.toLowerCase().includes(normalizedQuery)
    );
  }, [data, normalizedQuery]);

  const requireSession = () => {
    if (currentUser) {
      return true;
    }
    window.location.assign(`/login?next=${encodeURIComponent(`/shop/${vendorId}`)}`);
    return false;
  };

  if (isPending) {
    return (
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
        <ProductCardSkeleton />
        <ProductCardSkeleton />
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-14 sm:px-6">
        <article className="premium-card border border-rose-200 bg-rose-50 p-6">
          <h1 className="text-xl font-semibold text-rose-700">Boutique introuvable</h1>
          <p className="mt-2 text-sm text-rose-700">
            Cette boutique n&apos;est pas disponible ou a ete desactivee.
          </p>
        </article>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-14 sm:px-6">
      <StorefrontHero data={data} />

      <article className="premium-card border border-slate-200 bg-white p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#FF4D00]" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher dans cette boutique, restaurant, hotel ou services..."
            className="h-11 rounded-xl border-slate-200 bg-white pl-9 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>
      </article>

      {data.gallery_images.length ? (
        <article className="premium-card border border-slate-200 bg-white p-5">
          <h2 className="luxury-title inline-flex items-center gap-2 text-xl font-semibold">
            <Images className="h-5 w-5 text-[#FF4D00]" />
            Galerie
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {data.gallery_images.map((imageUrl) => (
              <div key={imageUrl} className="overflow-hidden rounded-2xl bg-slate-100">
                <Image
                  src={resolveImageUrl(imageUrl) ?? imageUrl}
                  alt={data.business_name}
                  width={600}
                  height={600}
                  unoptimized
                  className="h-40 w-full object-cover"
                />
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {data.service_offerings.length ? (
        <article className="premium-card border border-slate-200 bg-white p-5">
          <h2 className="luxury-title text-xl font-semibold">Services</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {data.service_offerings.map((service) => (
              <div key={`${service.title}-${service.display_mode}`} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{service.title}</h3>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                    {service.display_mode === "consult_only" ? "Consultation" : service.display_mode}
                  </span>
                </div>
                {service.description ? <p className="mt-2 text-sm text-slate-600">{service.description}</p> : null}
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {data.activity_type === "restaurant" ? (
        <>
          <RestaurantMenuSection menu={filteredMenu} />
          {data.accepts_table_reservations ? (
            <article className="premium-card border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-5">
              <h2 className="luxury-title text-xl font-semibold">Reservation de table</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Nom"
                  value={reservationForm.customer_name}
                  onChange={(event) =>
                    setReservationForm((prev) => ({ ...prev, customer_name: event.target.value }))
                  }
                />
                <Input
                  placeholder="Telephone"
                  value={reservationForm.customer_phone}
                  onChange={(event) =>
                    setReservationForm((prev) => ({ ...prev, customer_phone: event.target.value }))
                  }
                />
                <Input
                  type="datetime-local"
                  value={reservationForm.reservation_at}
                  onChange={(event) =>
                    setReservationForm((prev) => ({ ...prev, reservation_at: event.target.value }))
                  }
                />
                <Input
                  type="number"
                  min={1}
                  value={reservationForm.guest_count}
                  onChange={(event) =>
                    setReservationForm((prev) => ({ ...prev, guest_count: event.target.value }))
                  }
                  placeholder="Nombre de personnes"
                />
                <textarea
                  value={reservationForm.note}
                  onChange={(event) => setReservationForm((prev) => ({ ...prev, note: event.target.value }))}
                  className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
                  placeholder="Demande speciale"
                />
              </div>
              <Button
                className="primary-glow-btn mt-4 bg-[#FF4D00] text-white hover:bg-[#e74700]"
                onClick={() => {
                  if (!requireSession()) return;
                  reservationMutation.mutate();
                }}
              >
                Reserver une table
              </Button>
            </article>
          ) : null}
        </>
      ) : null}

      {data.activity_type === "hotel" || data.activity_type === "enterprise" ? (
        <>
          <HotelRoomSection rooms={filteredRooms} />
          {data.accepts_hotel_bookings ? (
            <article className="premium-card border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5">
              <h2 className="luxury-title inline-flex items-center gap-2 text-xl font-semibold">
                <Hotel className="h-5 w-5 text-[#0ea5e9]" />
                Reservation hotel avec acompte
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Acompte obligatoire via {data.deposit_payment_method || "Nita/Amana"} pour valider la demande.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <select
                  value={hotelForm.room_type_id}
                  onChange={(event) => setHotelForm((prev) => ({ ...prev, room_type_id: event.target.value }))}
                  className="h-11 rounded-md border border-slate-300 px-3 text-sm"
                >
                  <option value="">Choisir une chambre</option>
                  {data.room_types.map((room) => (
                    <option key={room.id || room.name} value={room.id || room.name}>
                      {room.name} • {formatXOF(room.night_price)}/nuit
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Nom"
                  value={hotelForm.guest_name}
                  onChange={(event) => setHotelForm((prev) => ({ ...prev, guest_name: event.target.value }))}
                />
                <Input
                  placeholder="Telephone"
                  value={hotelForm.guest_phone}
                  onChange={(event) => setHotelForm((prev) => ({ ...prev, guest_phone: event.target.value }))}
                />
                <Input
                  placeholder="Email"
                  value={hotelForm.guest_email}
                  onChange={(event) => setHotelForm((prev) => ({ ...prev, guest_email: event.target.value }))}
                />
                <Input
                  type="date"
                  value={hotelForm.check_in_date}
                  onChange={(event) => setHotelForm((prev) => ({ ...prev, check_in_date: event.target.value }))}
                />
                <Input
                  type="date"
                  value={hotelForm.check_out_date}
                  onChange={(event) => setHotelForm((prev) => ({ ...prev, check_out_date: event.target.value }))}
                />
                <Input
                  type="number"
                  min={1}
                  value={hotelForm.guest_count}
                  onChange={(event) => setHotelForm((prev) => ({ ...prev, guest_count: event.target.value }))}
                  placeholder="Voyageurs"
                />
                <select
                  value={hotelForm.deposit_payment_method}
                  onChange={(event) =>
                    setHotelForm((prev) => ({
                      ...prev,
                      deposit_payment_method: event.target.value as "nita" | "amana",
                    }))
                  }
                  className="h-11 rounded-md border border-slate-300 px-3 text-sm"
                >
                  <option value="nita">Nita</option>
                  <option value="amana">Amana</option>
                </select>
                <Input
                  placeholder="Reference transaction"
                  value={hotelForm.transaction_reference}
                  onChange={(event) =>
                    setHotelForm((prev) => ({ ...prev, transaction_reference: event.target.value }))
                  }
                  className="md:col-span-2"
                />
                <textarea
                  value={hotelForm.special_request}
                  onChange={(event) => setHotelForm((prev) => ({ ...prev, special_request: event.target.value }))}
                  className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
                  placeholder="Demande speciale"
                />
              </div>
              <Button
                className="mt-4 border border-sky-300 bg-sky-600 text-white hover:bg-sky-700"
                onClick={() => {
                  if (!requireSession()) return;
                  hotelBookingMutation.mutate();
                }}
              >
                Envoyer ma reservation
              </Button>
            </article>
          ) : null}
        </>
      ) : null}

      {data.products.length ? <RetailShopContent products={filteredProducts} /> : null}
      {status ? <p className="text-sm text-slate-700">{status}</p> : null}
    </section>
  );
}

function StorefrontHero({ data }: { data: SellerStorefront }) {
  return (
    <header className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="relative h-52 w-full bg-gradient-to-br from-slate-900 via-slate-800 to-[#0f172a]">
        {data.cover_image_url ? (
          <Image
            src={resolveImageUrl(data.cover_image_url) ?? data.cover_image_url}
            alt={data.business_name}
            fill
            unoptimized
            className="object-cover opacity-80"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/35 to-transparent" />
        <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-end gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-white/25 bg-white/10 backdrop-blur">
              {data.logo_url ? (
                <Image
                  src={resolveImageUrl(data.logo_url) ?? data.logo_url}
                  alt={data.business_name}
                  width={80}
                  height={80}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                <Store className="h-8 w-8 text-white" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="luxury-title text-3xl font-semibold text-white">{data.business_name}</h1>
                {data.is_verified ? <ShieldCheck className="h-5 w-5 text-emerald-300" /> : null}
              </div>
              <p className="mt-2 text-sm text-white/80">
                {activityLabels[data.activity_type]} {data.storefront_tier === "premium" ? "Premium" : "Basic"} •{" "}
                {data.city ?? "Niamey"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill>{activityLabels[data.activity_type]}</Pill>
            {data.storefront_tier === "premium" ? <Pill>Premium</Pill> : null}
            {data.accepts_table_reservations ? <Pill>Reservation table</Pill> : null}
            {data.accepts_hotel_bookings ? <Pill>Reservation hotel</Pill> : null}
          </div>
        </div>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-[1.4fr_0.8fr]">
        <div>
          {data.description ? <p className="text-sm leading-6 text-slate-700">{data.description}</p> : null}
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
            {data.address ? <span>{data.address}</span> : null}
            {data.opening_hours ? <span>{data.opening_hours}</span> : null}
          </div>
        </div>
        <div className="space-y-1 text-sm text-slate-600">
          {data.phone ? <p>Telephone: {data.phone}</p> : null}
          {data.whatsapp_contact ? <p>WhatsApp: {data.whatsapp_contact}</p> : null}
          {data.contact_email ? <p>Email: {data.contact_email}</p> : null}
          {data.deposit_amount ? (
            <p>Acompte de reference: {formatXOF(data.deposit_amount)}</p>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function RetailShopContent({ products }: { products: SellerStorefrontProduct[] }) {
  if (!products.length) {
    return (
      <article className="premium-card border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Aucun article publie dans cette boutique pour le moment.
      </article>
    );
  }

  return (
    <article className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="luxury-title text-xl font-semibold">Catalogue de la boutique</h2>
        <p className="text-xs text-slate-500">{products.length} article(s)</p>
      </header>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {products.map((item) => (
          <div
            key={item.price_id}
            className="premium-card hover-lift-glow overflow-hidden border border-white/20 bg-white/80 p-0"
          >
            <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
              {item.main_image_url ? (
                <Image
                  src={resolveImageUrl(item.main_image_url) ?? item.main_image_url}
                  alt={item.name}
                  width={640}
                  height={480}
                  unoptimized
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <Flame className="h-8 w-8" />
                </div>
              )}
            </div>
            <div className="space-y-2 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">{item.brand}</p>
              <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{item.name}</h3>
              <p className="text-base font-semibold text-[#FF4D00]">{formatXOF(item.amount)}</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function RestaurantMenuSection({ menu }: { menu: RestaurantMenuItem[] }) {
  if (!menu.length) {
    return (
      <article className="premium-card border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Aucun plat publie pour ce restaurant pour le moment.
      </article>
    );
  }

  return (
    <article className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="luxury-title inline-flex items-center gap-2 text-xl font-semibold">
          <UtensilsCrossed className="h-5 w-5 text-[#FF4D00]" />
          Menu digital
        </h2>
        <p className="text-xs text-slate-500">{menu.length} plat(s)</p>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {menu.map((dish) => (
          <div
            key={dish.id}
            className="premium-card hover-lift-glow overflow-hidden border border-orange-200 bg-gradient-to-br from-orange-50 via-amber-50 to-white p-0"
          >
            <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
              {dish.image_url ? (
                <Image
                  src={resolveImageUrl(dish.image_url) ?? dish.image_url}
                  alt={dish.name}
                  width={640}
                  height={480}
                  unoptimized
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <UtensilsCrossed className="h-8 w-8" />
                </div>
              )}
            </div>
            <div className="space-y-2 p-4">
              <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{dish.name}</h3>
              {dish.description ? <p className="line-clamp-3 text-sm text-slate-600">{dish.description}</p> : null}
              {dish.tags?.length ? <p className="text-xs text-slate-500">{dish.tags.join(" • ")}</p> : null}
              <p className="text-base font-semibold text-[#FF4D00]">{formatXOF(dish.base_price)}</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function HotelRoomSection({ rooms }: { rooms: HotelRoomType[] }) {
  if (!rooms.length) {
    return (
      <article className="premium-card border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Aucune chambre publiee pour cet etablissement pour le moment.
      </article>
    );
  }

  return (
    <article className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="luxury-title inline-flex items-center gap-2 text-xl font-semibold">
          <BedDouble className="h-5 w-5 text-sky-600" />
          Types de chambres
        </h2>
        <p className="text-xs text-slate-500">{rooms.length} option(s)</p>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rooms.map((room) => (
          <div key={room.id || room.name} className="rounded-3xl border border-sky-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">{room.name}</h3>
              <span className="text-sm font-semibold text-sky-700">{formatXOF(room.night_price)}/nuit</span>
            </div>
            {room.description ? <p className="mt-2 text-sm text-slate-600">{room.description}</p> : null}
            <p className="mt-2 text-xs text-slate-500">Capacite: {room.capacity} personne(s)</p>
            {room.deposit_amount ? (
              <p className="mt-1 text-xs text-slate-500">Acompte: {formatXOF(room.deposit_amount)}</p>
            ) : null}
            {room.amenities.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {room.amenities.map((amenity) => (
                  <span
                    key={`${room.id || room.name}-${amenity}`}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                  >
                    {amenity}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </article>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
      {children}
    </span>
  );
}
