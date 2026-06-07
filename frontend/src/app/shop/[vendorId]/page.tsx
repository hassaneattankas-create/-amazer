"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BedDouble, Flame, Hotel, Images, Search, ShieldCheck, Store, UtensilsCrossed } from "lucide-react";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatXOF } from "@/lib/currency";
import { resolveImageUrl } from "@/lib/image";
import { computeRestaurantOrderSummary } from "@/lib/restaurant-order-pricing";
import { getRestaurantOrderPayRoute, getRestaurantOrderReceiptRoute } from "@/lib/mobile-routes";
import { getPublicFinanceSettings } from "@/services/finance-service";
import { notifyLocalOrderEvent } from "@/services/notification-service";
import { createRestaurantOrder, createRestaurantReservation, getRestaurantReceiptLink } from "@/services/restaurant-service";
import { getProductDetailById } from "@/services/product-service";
import { createHotelBooking, getSellerStorefront } from "@/services/seller-service";
import { useCartStore } from "@/store/cartStore";
import type { HotelRoomType, SellerStorefront, SellerStorefrontProduct } from "@/types/seller";
import type { RestaurantMenuItem, RestaurantMenuOption } from "@/types/restaurant";

const activityLabels = {
  shop: "Boutique",
  restaurant: "Restaurant",
  hotel: "Premium",
  enterprise: "Premium",
  transport: "Transport",
} as const;

type SelectedMenuItem = {
  menu_item_id: string;
  vendor_id: string;
  name: string;
  quantity: number;
  base_price: number;
  selected_options: RestaurantMenuOption[];
  customer_note: string;
};

export default function VendorShopPage() {
  const params = useParams<{ vendorId: string }>();
  const vendorId = params.vendorId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const addItem = useCartStore((state) => state.addItem);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [cartMessage, setCartMessage] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [selectedItems, setSelectedItems] = useState<SelectedMenuItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [paymentMode, setPaymentMode] = useState<"nita" | "amana">("nita");
  const [reservationForm, setReservationForm] = useState({
    customer_name: "",
    customer_phone: "",
    reservation_at: "",
    guest_count: "2",
    note: "",
    deposit_payment_method: "nita" as "nita" | "amana",
    transaction_reference: "",
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
  const { data: financeSettings } = useQuery({
    queryKey: ["public-finance-settings"],
    queryFn: getPublicFinanceSettings,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });

  const addProductMutation = useMutation({
    mutationFn: (productId: string) => getProductDetailById(productId),
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
        deposit_payment_method: reservationForm.deposit_payment_method,
        transaction_reference: reservationForm.transaction_reference || undefined,
      }),
    onSuccess: () => {
      setStatus("Reservation de table envoyee au restaurateur.");
      setReservationForm({
        customer_name: "",
        customer_phone: "",
        reservation_at: "",
        guest_count: "2",
        note: "",
        deposit_payment_method: "nita",
        transaction_reference: "",
      });
      queryClient.invalidateQueries({ queryKey: ["seller-storefront", vendorId] });
    },
    onError: (error) =>
      setStatus(getApiErrorMessage(error, "Impossible d'envoyer la reservation de table.")),
  });

  const orderMutation = useMutation({
    mutationFn: createRestaurantOrder,
    onSuccess: async (order) => {
      setOrderStatus(`Commande creee chez ${order.vendor_name}.`);
      setSelectedItems([]);
      notifyLocalOrderEvent({
        title: "Commande restaurant",
        body:
          order.payment_status === "paid"
            ? "Paiement deja confirme avec code transaction."
            : "Finalise le paiement sur la page securisee.",
        tag: `restaurant-order-${order.id}`,
        href:
          order.payment_status === "paid"
            ? "/restaurant"
            : getRestaurantOrderPayRoute(order.id),
      });
      if (order.payment_status === "pending") {
        router.push(getRestaurantOrderPayRoute(order.id));
      } else {
        const receipt = await getRestaurantReceiptLink(order.id);
        router.push(getRestaurantOrderReceiptRoute(order.id, receipt.token));
      }
    },
    onError: (error) =>
      setOrderStatus(
        getApiErrorMessage(error, "Échec envoi commande. Vérifie les champs et reconnecte-toi.")
      ),
  });

  const hotelBookingMutation = useMutation({
    mutationFn: () => {
      // Transport: une seule date (voyage). On derive la date de fin pour reutiliser le meme backend.
      let checkOut = hotelForm.check_out_date;
      if ((data?.offers_transport || data?.activity_type === "transport") && hotelForm.check_in_date) {
        const d = new Date(hotelForm.check_in_date);
        d.setDate(d.getDate() + 1);
        checkOut = d.toISOString().slice(0, 10);
      }
      return createHotelBooking(vendorId, {
        vendor_id: vendorId,
        room_type_id: hotelForm.room_type_id,
        guest_name: hotelForm.guest_name,
        guest_phone: hotelForm.guest_phone,
        guest_email: hotelForm.guest_email || undefined,
        check_in_date: hotelForm.check_in_date,
        check_out_date: checkOut,
        guest_count: Number(hotelForm.guest_count || 1),
        deposit_payment_method: hotelForm.deposit_payment_method,
        transaction_reference: hotelForm.transaction_reference || undefined,
        special_request: hotelForm.special_request || undefined,
      });
    },
    onSuccess: () => {
      setStatus("Demande de reservation premium envoyee.");
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
    onError: (error) =>
      setStatus(getApiErrorMessage(error, "Impossible d'envoyer la reservation premium.")),
  });

  const handleAddProduct = (productId: string, redirectToCart = false) => {
    if (!productId) {
      setCartMessage("Produit indisponible pour le panier.");
      window.setTimeout(() => setCartMessage(""), 2400);
      return;
    }
    addProductMutation.mutate(productId, {
      onSuccess: (data) => {
        addItem({
          productId: data.product.id,
          name: data.product.name,
          offersSnapshot: data.offers,
          quantity: 1,
        });
        if (redirectToCart) {
          router.push("/cart");
          return;
        }
        setCartMessage("Produit ajoute au panier.");
        window.setTimeout(() => setCartMessage(""), 2400);
      },
      onError: () => {
        setCartMessage("Impossible d'ajouter au panier.");
        window.setTimeout(() => setCartMessage(""), 2400);
      },
    });
  };

  const addDish = (dish: RestaurantMenuItem) => {
    setSelectedItems((prev) => {
      const existing = prev.find((item) => item.menu_item_id === dish.id);
      if (existing) {
        return prev.map((item) =>
          item.menu_item_id === dish.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          menu_item_id: dish.id,
          vendor_id: dish.vendor_id,
          name: dish.name,
          quantity: 1,
          base_price: dish.base_price,
          selected_options: [],
          customer_note: "",
        },
      ];
    });
  };

  const toggleOption = (menuItemId: string, option: RestaurantMenuOption) => {
    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item.menu_item_id !== menuItemId) return item;
        const exists = item.selected_options.some((entry) => entry.name === option.name);
        return {
          ...item,
          selected_options: exists
            ? item.selected_options.filter((entry) => entry.name !== option.name)
            : [...item.selected_options, option],
        };
      })
    );
  };

  const setItemNote = (menuItemId: string, customerNote: string) => {
    setSelectedItems((prev) =>
      prev.map((item) => (item.menu_item_id === menuItemId ? { ...item, customer_note: customerNote } : item))
    );
  };

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

  const isTransport = Boolean(data?.offers_transport) || data?.activity_type === "transport";
  const isPremiumStore =
    data?.storefront_tier === "premium" || data?.activity_type === "hotel" || data?.activity_type === "enterprise";
  const showRestaurantSection = !isTransport && (data?.activity_type === "restaurant" || Boolean(isPremiumStore));
  const canOrder = showRestaurantSection && filteredMenu.length > 0;

  const total = useMemo(
    () =>
      selectedItems.reduce((sum, item) => {
        const optionsTotal = item.selected_options.reduce((acc, option) => acc + option.price, 0);
        return sum + (item.base_price + optionsTotal) * item.quantity;
      }, 0),
    [selectedItems]
  );
  const restaurantPricing = useMemo(
    () =>
      computeRestaurantOrderSummary(
        total,
        financeSettings?.default_delivery_fee ?? 1500,
        data?.effective_commission_rate ?? financeSettings?.commission_rate ?? 0.05,
        data?.effective_service_fee ?? financeSettings?.service_fee ?? 200
      ),
    [
      data?.effective_commission_rate,
      data?.effective_service_fee,
      financeSettings?.commission_rate,
      financeSettings?.default_delivery_fee,
      financeSettings?.service_fee,
      total,
    ]
  );

  const requireSession = () => {
    if (currentUser) {
      return true;
    }
    window.location.assign(`/login?next=${encodeURIComponent(`/shop/${vendorId}`)}`);
    return false;
  };

  const submitOrder = () => {
    if (!selectedItems.length) {
      setOrderStatus("Ajoute au moins un plat avant de commander.");
      return;
    }
    if (!requireSession()) {
      return;
    }
    if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim()) {
      setOrderStatus("Renseigne ton nom, ton telephone et l'adresse de livraison.");
      return;
    }
    orderMutation.mutate({
      vendor_id: vendorId,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      delivery_address: deliveryAddress.trim(),
      payment_mode: paymentMode,
      items: selectedItems.map((item) => ({
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        selected_options: item.selected_options,
        customer_note: item.customer_note.trim() || undefined,
      })),
    });
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
            placeholder="Rechercher dans cette boutique, restaurant, premium ou services..."
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
            {data.gallery_images.map((imageUrl, index) => (
              <div key={`gallery-${index}-${imageUrl}`} className="overflow-hidden rounded-2xl bg-slate-100">
                <Image
                  src={resolveImageUrl(imageUrl) ?? "/images/placeholders/default.svg"}
                  alt={data.business_name}
                  width={600}
                  height={600}
                  sizes="(max-width: 768px) 100vw, 600px"
                  quality={82}
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

      {showRestaurantSection ? (
        <>
          <RestaurantMenuSection
            menu={filteredMenu}
            selectedItems={selectedItems}
            onAddDish={addDish}
            onToggleOption={toggleOption}
          />
          {data.accepts_table_reservations ? (
            <article className="premium-card border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-5">
              <h2 className="luxury-title text-xl font-semibold">Reservation de table</h2>
              {data.deposit_amount && data.deposit_amount > 0 ? (
                <p className="mt-2 text-sm text-slate-600">
                  Acompte de {formatXOF(data.deposit_amount)} via{" "}
                  {data.deposit_payment_method?.toUpperCase() || "Nita/Amana"} obligatoire : la
                  reservation n&apos;est validee qu&apos;apres paiement.
                </p>
              ) : null}
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
                {data.deposit_amount && data.deposit_amount > 0 ? (
                  <>
                    <select
                      aria-label="Mode de paiement de l'acompte"
                      value={reservationForm.deposit_payment_method}
                      onChange={(event) =>
                        setReservationForm((prev) => ({
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
                      placeholder="Reference de paiement de l'acompte"
                      value={reservationForm.transaction_reference}
                      onChange={(event) =>
                        setReservationForm((prev) => ({
                          ...prev,
                          transaction_reference: event.target.value,
                        }))
                      }
                    />
                  </>
                ) : null}
              </div>
              <Button
                className="primary-glow-btn mt-4 bg-[#FF4D00] text-white hover:bg-[#e74700]"
                onClick={() => {
                  if (!requireSession()) return;
                  if (
                    data.deposit_amount &&
                    data.deposit_amount > 0 &&
                    !reservationForm.transaction_reference.trim()
                  ) {
                    setStatus(
                      "Saisis la reference de paiement de l'acompte pour valider la reservation."
                    );
                    return;
                  }
                  reservationMutation.mutate();
                }}
              >
                Reserver
              </Button>
            </article>
          ) : null}
          {canOrder ? (
            <RestaurantOrderPanel
              selectedItems={selectedItems}
              total={total}
              deliveryFee={restaurantPricing.deliveryFee}
              platformCommission={restaurantPricing.platformCommission}
              platformServiceFee={restaurantPricing.platformServiceFee}
              grandTotal={restaurantPricing.totalAmount}
              customerName={customerName}
              customerPhone={customerPhone}
              deliveryAddress={deliveryAddress}
              paymentMode={paymentMode}
              isSubmitting={orderMutation.isPending}
              onCustomerNameChange={setCustomerName}
              onCustomerPhoneChange={setCustomerPhone}
              onDeliveryAddressChange={setDeliveryAddress}
              onPaymentModeChange={setPaymentMode}
              onItemNoteChange={setItemNote}
              onSubmit={submitOrder}
              statusMessage={orderStatus}
            />
          ) : null}
        </>
      ) : null}

      {data.activity_type === "hotel" || data.activity_type === "enterprise" || isTransport ? (
        <>
          {!isTransport ? <HotelRoomSection rooms={filteredRooms} /> : null}
          {data.accepts_hotel_bookings ? (
            <article className="premium-card border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5">
              <h2 className="luxury-title inline-flex items-center gap-2 text-xl font-semibold">
                <Hotel className="h-5 w-5 text-[#0ea5e9]" />
                {isTransport ? "Reservation de trajet avec acompte" : "Reservation premium avec acompte"}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {data.deposit_amount && data.deposit_amount > 0
                  ? `Acompte via ${data.deposit_payment_method?.toUpperCase() || "Nita/Amana"} obligatoire : la reservation n'est validee qu'apres paiement.`
                  : "Acompte optionnel selon le prestataire. Si un acompte est demande, la reservation n'est validee qu'apres paiement."}
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <select
                  aria-label={isTransport ? "Choisir un trajet" : "Choisir une chambre"}
                  value={hotelForm.room_type_id}
                  onChange={(event) => setHotelForm((prev) => ({ ...prev, room_type_id: event.target.value }))}
                  className="h-11 rounded-md border border-slate-300 px-3 text-sm"
                >
                  <option value="">{isTransport ? "Choisir un trajet" : "Choisir une chambre"}</option>
                  {data.room_types.map((room) => (
                    <option key={room.id || room.name} value={room.id || room.name}>
                      {room.name} - {formatXOF(room.night_price)}{isTransport ? "/place" : "/nuit"}
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
                <div className={isTransport ? "md:col-span-2" : ""}>
                  <label className="mb-1 block text-xs text-slate-500">
                    {isTransport ? "Date de voyage" : "Date d'arrivee"}
                  </label>
                  <Input
                    type="date"
                    value={hotelForm.check_in_date}
                    onChange={(event) => setHotelForm((prev) => ({ ...prev, check_in_date: event.target.value }))}
                  />
                </div>
                {!isTransport ? (
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Date de depart</label>
                    <Input
                      type="date"
                      value={hotelForm.check_out_date}
                      onChange={(event) => setHotelForm((prev) => ({ ...prev, check_out_date: event.target.value }))}
                    />
                  </div>
                ) : null}
                <Input
                  type="number"
                  min={1}
                  value={hotelForm.guest_count}
                  onChange={(event) => setHotelForm((prev) => ({ ...prev, guest_count: event.target.value }))}
                  placeholder={isTransport ? "Nombre de places" : "Voyageurs"}
                />
                <select
                  aria-label="Mode de paiement de l'acompte"
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
                  const selectedRoom = data.room_types.find(
                    (room) => (room.id || room.name) === hotelForm.room_type_id
                  );
                  const deposit = Number(selectedRoom?.deposit_amount || data.deposit_amount || 0);
                  if (deposit > 0 && !hotelForm.transaction_reference.trim()) {
                    setStatus(
                      "Saisis la reference de paiement de l'acompte pour valider la reservation."
                    );
                    return;
                  }
                  hotelBookingMutation.mutate();
                }}
              >
                Envoyer ma reservation
              </Button>
            </article>
          ) : null}
        </>
      ) : null}

      {data.products.length ? (
        <RetailShopContent
          products={filteredProducts}
          onAddToCart={(productId) => handleAddProduct(productId)}
          onBuyNow={(productId) => handleAddProduct(productId, true)}
          isAdding={addProductMutation.isPending}
          cartMessage={cartMessage}
        />
      ) : null}
      {status ? <p className="text-sm text-slate-700">{status}</p> : null}
    </section>
  );
}

function StorefrontHero({ data }: { data: SellerStorefront }) {
  const isPremium = data.storefront_tier === "premium";
  return (
    <header
      className={`overflow-hidden rounded-[28px] border bg-white ${
        isPremium
          ? "border-amber-300/70 shadow-[0_10px_40px_rgba(217,164,65,0.25)] ring-1 ring-amber-200/60"
          : "border-slate-200 shadow-sm"
      }`}
    >
      {isPremium ? (
        <div className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-950">
          <span aria-hidden>👑</span>
          Boutique Premium AMAZER
          <span aria-hidden>👑</span>
        </div>
      ) : null}
      <div className="relative h-56 w-full bg-gradient-to-br from-slate-900 via-slate-800 to-[#0f172a]">
        {data.cover_image_url ? (
          <Image
            src={resolveImageUrl(data.cover_image_url) ?? "/images/placeholders/default.svg"}
            alt={data.business_name}
            fill
            sizes="(max-width: 768px) 100vw, 1200px"
            quality={82}
            unoptimized
            className="object-cover opacity-85"
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-transparent" />

        {isPremium ? (
          <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-amber-400/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-950 shadow-lg backdrop-blur">
            <span aria-hidden>👑</span>
            Premium
          </div>
        ) : null}

        <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-end gap-4">
            <div
              className={`flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl backdrop-blur ${
                isPremium ? "border-2 border-amber-300/70 bg-white/10" : "border border-white/25 bg-white/10"
              }`}
            >
              {data.logo_url ? (
                <Image
                  src={resolveImageUrl(data.logo_url) ?? "/images/placeholders/default.svg"}
                  alt={data.business_name}
                  width={96}
                  height={96}
                  sizes="96px"
                  quality={85}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                <Store className="h-9 w-9 text-white" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="luxury-title text-3xl font-semibold text-white">{data.business_name}</h1>
                {data.is_verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/50 bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Vérifié
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-white/80">
                {activityLabels[data.activity_type]} {isPremium ? "Premium" : "Basic"} -{" "}
                {data.city ?? "Niamey"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill>{activityLabels[data.activity_type]}</Pill>
            {isPremium ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-amber-400/25 px-3 py-1 text-xs font-semibold text-amber-100">
                <span aria-hidden>👑</span> Premium
              </span>
            ) : null}
            {data.accepts_table_reservations ? <Pill>Reservation table</Pill> : null}
            {data.accepts_hotel_bookings ? <Pill>Reservation premium</Pill> : null}
            {data.offers_transport ? <Pill>Transport</Pill> : null}
          </div>
        </div>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-[1.4fr_0.8fr]">
        <div>
          {data.description ? <p className="text-sm leading-6 text-slate-700">{data.description}</p> : null}
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
            {data.address ? <span>📍 {data.address}</span> : null}
            {data.opening_hours ? <span>🕒 {data.opening_hours}</span> : null}
          </div>
        </div>
        <div
          className={`space-y-1 rounded-2xl p-4 text-sm text-slate-600 ${
            isPremium ? "border border-amber-100 bg-amber-50/60" : "border border-slate-100 bg-slate-50/60"
          }`}
        >
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</p>
          {data.phone ? <p>Téléphone : {data.phone}</p> : null}
          {data.whatsapp_contact ? <p>WhatsApp : {data.whatsapp_contact}</p> : null}
          {data.contact_email ? <p>Email : {data.contact_email}</p> : null}
          {data.deposit_amount ? (
            <p>Acompte de référence : {formatXOF(data.deposit_amount)}</p>
          ) : null}
        </div>
      </div>
    </header>
  );
}

type RetailShopContentProps = {
  products: SellerStorefrontProduct[];
  onAddToCart: (productId: string) => void;
  onBuyNow: (productId: string) => void;
  isAdding?: boolean;
  cartMessage?: string;
};

function RetailShopContent({
  products,
  onAddToCart,
  onBuyNow,
  isAdding = false,
  cartMessage,
}: RetailShopContentProps) {
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
      {cartMessage ? <p className="text-xs text-emerald-600">{cartMessage}</p> : null}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {products.map((item) => (
          <div
            key={item.price_id}
            className="premium-card hover-lift-glow overflow-hidden border border-white/20 bg-white/80 p-0"
          >
            <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
              {item.main_image_url ? (
                <Image
                  src={resolveImageUrl(item.main_image_url) ?? "/images/placeholders/default.svg"}
                  alt={item.name}
                  width={560}
                  height={420}
                  loading="lazy"
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 384px"
                  quality={82}
                  unoptimized
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
              {item.description ? (
                <p className="line-clamp-2 text-xs text-slate-600">{item.description}</p>
              ) : null}
              <p className="text-base font-semibold text-[#FF4D00]">{formatXOF(item.amount)}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => onAddToCart(item.product_id)}
                  disabled={isAdding || !item.product_id}
                  className="border border-[#FF4D00]/30 bg-[#FF4D00]/10 text-[#FF4D00] hover:bg-[#FF4D00]/15"
                >
                  Ajouter au panier
                </Button>
                <Button
                  type="button"
                  onClick={() => onBuyNow(item.product_id)}
                  disabled={isAdding || !item.product_id}
                  className="primary-glow-btn bg-[#FF4D00] text-white hover:bg-[#e74700]"
                >
                  Acheter
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

type RestaurantMenuSectionProps = {
  menu: RestaurantMenuItem[];
  selectedItems: SelectedMenuItem[];
  onAddDish: (dish: RestaurantMenuItem) => void;
  onToggleOption: (menuItemId: string, option: RestaurantMenuOption) => void;
};

function RestaurantMenuSection({
  menu,
  selectedItems,
  onAddDish,
  onToggleOption,
}: RestaurantMenuSectionProps) {
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
        {menu.map((dish) => {
          const selectedItem = selectedItems.find((item) => item.menu_item_id === dish.id);
          return (
          <div
            key={dish.id}
            className="premium-card hover-lift-glow overflow-hidden border border-orange-200 bg-gradient-to-br from-orange-50 via-amber-50 to-white p-0"
          >
            <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
              {dish.image_url ? (
                <Image
                  src={resolveImageUrl(dish.image_url) ?? "/images/placeholders/default.svg"}
                  alt={dish.name}
                  width={560}
                  height={420}
                  loading="lazy"
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 384px"
                  quality={82}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <UtensilsCrossed className="h-8 w-8" />
                </div>
              )}
            </div>
            <div className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{dish.name}</h3>
                {selectedItem ? (
                  <span className="rounded-full border border-[#FF4D00]/30 bg-white px-2 py-0.5 text-[10px] font-semibold text-[#FF4D00]">
                    x{selectedItem.quantity}
                  </span>
                ) : null}
              </div>
              {dish.description ? <p className="line-clamp-3 text-sm text-slate-600">{dish.description}</p> : null}
              {dish.tags?.length ? <p className="text-xs text-slate-500">{dish.tags.join(" - ")}</p> : null}
              <p className="text-base font-semibold text-[#FF4D00]">{formatXOF(dish.base_price)}</p>
              {dish.options.length ? (
                <div className="rounded-xl border border-orange-100 bg-white/70 p-2">
                  <p className="text-xs font-medium text-slate-700">Options</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {dish.options.map((option) => {
                      const isSelected = selectedItem?.selected_options.some((entry) => entry.name === option.name);
                      return (
                        <button
                          key={`${dish.id}-${option.name}`}
                          type="button"
                          onClick={() => onToggleOption(dish.id, option)}
                          className={
                            isSelected
                              ? "rounded-full border border-[#FF4D00]/40 bg-[#FF4D00]/10 px-2 py-1 text-xs text-[#FF4D00]"
                              : "rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                          }
                        >
                          {option.name} (+{formatXOF(option.price)})
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <Button
                type="button"
                onClick={() => onAddDish(dish)}
                className="primary-glow-btn w-full bg-[#FF4D00] text-white hover:bg-[#e74700]"
              >
                Ajouter au panier repas
              </Button>
            </div>
          </div>
        );
        })}
      </div>
    </article>
  );
}

type RestaurantOrderPanelProps = {
  selectedItems: SelectedMenuItem[];
  total: number;
  deliveryFee: number;
  platformCommission: number;
  platformServiceFee: number;
  grandTotal: number;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  paymentMode: "nita" | "amana";
  isSubmitting: boolean;
  statusMessage?: string;
  onCustomerNameChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  onDeliveryAddressChange: (value: string) => void;
  onPaymentModeChange: (value: "nita" | "amana") => void;
  onItemNoteChange: (menuItemId: string, note: string) => void;
  onSubmit: () => void;
};

function RestaurantOrderPanel({
  selectedItems,
  total,
  deliveryFee,
  platformCommission,
  platformServiceFee,
  grandTotal,
  customerName,
  customerPhone,
  deliveryAddress,
  paymentMode,
  isSubmitting,
  statusMessage,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onDeliveryAddressChange,
  onPaymentModeChange,
  onItemNoteChange,
  onSubmit,
}: RestaurantOrderPanelProps) {
  return (
    <article className="premium-card border border-slate-200 bg-white p-6">
      <h2 className="luxury-title text-xl font-semibold">Commander maintenant</h2>
      <p className="mt-1 text-sm text-slate-600">
        Ajoute des plats au panier puis renseigne les informations de livraison.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Input value={customerName} onChange={(event) => onCustomerNameChange(event.target.value)} placeholder="Nom complet" />
        <Input value={customerPhone} onChange={(event) => onCustomerPhoneChange(event.target.value)} placeholder="Telephone" />
        <Input
          value={deliveryAddress}
          onChange={(event) => onDeliveryAddressChange(event.target.value)}
          placeholder="Adresse livraison"
          className="sm:col-span-2"
        />
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          {[
            { value: "nita", label: "Nita" },
            { value: "amana", label: "Amana" },
          ].map((entry) => (
            <Button
              key={entry.value}
              type="button"
              onClick={() => onPaymentModeChange(entry.value as "nita" | "amana")}
              className={
                paymentMode === entry.value
                  ? "border border-[#FF4D00]/35 bg-[#FF4D00]/10 text-[#FF4D00]"
                  : "border border-slate-200 bg-white text-slate-700"
              }
            >
              {entry.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-700">
        <p className="mt-1">Sous-total plats: {formatXOF(total)}</p>
        <p className="mt-1">Frais de livraison: {formatXOF(deliveryFee)}</p>
        <p className="mt-1">Commission plateforme: {formatXOF(platformCommission)}</p>
        <p className="mt-1">Frais de service: {formatXOF(platformServiceFee)}</p>
        <p className="mt-1 font-semibold text-slate-900">Total a payer: {formatXOF(grandTotal)}</p>
        <p className="mt-1">Articles: {selectedItems.length}</p>
      </div>

      {selectedItems.length ? (
        <div className="mt-4 space-y-3">
          {selectedItems.map((item) => (
            <div key={item.menu_item_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">
                  {item.name} x{item.quantity}
                </p>
                <p className="text-sm font-semibold text-[#FF4D00]">{formatXOF(item.base_price * item.quantity)}</p>
              </div>
              <textarea
                value={item.customer_note}
                onChange={(event) => onItemNoteChange(item.menu_item_id, event.target.value)}
                className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                placeholder='Note cuisine ou livraison, ex: "Pas de piment"'
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Ajoute un plat pour activer la commande.</p>
      )}

      <Button
        type="button"
        disabled={isSubmitting || !selectedItems.length}
        onClick={onSubmit}
        className="primary-glow-btn mt-4 bg-[#FF4D00] text-white hover:bg-[#e74700]"
      >
        {isSubmitting ? "Envoi en cours..." : "Valider et payer"}
      </Button>

      {statusMessage ? <p className="mt-3 text-sm text-slate-700">{statusMessage}</p> : null}
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

