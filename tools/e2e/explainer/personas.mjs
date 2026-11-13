// Personnages de démonstration des guides : données fictives, aucune vraie personne ni vraie boutique.
// Chaque personnage = réponses simulées de l'API pour les écrans connectés.
// Les écrans publics (catalogue, produits) restent branchés sur le vrai site en lecture seule (proxy).
const now = Date.now();
const iso = (minAgo = 0) => new Date(now - minAgo * 60000).toISOString();
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
const me = (email, full_name, role = "user") => [/\/auth\/me$/, { id: "u1", email, full_name, whatsapp_phone: "+22790000001", is_active: true, role, created_at: iso(99999) }];
const subscription = [/\/seller\/subscription-status$/, { has_seller_profile: true, onboarding_fee_paid: true, onboarding_fee_paid_at: null, subscription_paid_until: iso(-30 * 1440), subscription_active: true, monthly_fee: 1000, onboarding_fee: 0, amount_due_now: 0, currency: "XOF", has_pending_payment_request: false }];
const stats = [/\/seller\/stats$/, { is_premium: false, this_week: { views: 84, contacts: 19, orders: 7 }, last_week: { views: 61, contacts: 21, orders: 5 }, days: Array.from({ length: 7 }, (_, i) => ({ day: new Date(now - (6 - i) * 86400000).toISOString().slice(0, 10), views: [5, 9, 14, 8, 17, 12, 19][i], contacts: 2 })) }];
const categories = [/\/categories/, { items: [] }];
// « Ma formule » (espace vendeur) : essai en cours, prix mensuel, ce qui attend le vendeur ensuite.
const plan = (kind, monthly_fee, o = {}) => [/\/seller\/plan-earnings$/, {
  plan: "subscribed", kind, in_trial: true, monthly_fee, eligible_free_plan: kind === "shop", max_visible_products: null, visible_products: 6,
  commission_rate: 0, free_plan_commission_rate: 0.05, free_plan_max_products: 5, subscription_paid_until: iso(-12 * 1440),
  to_receive: 0, awaiting_delivery: 12500, received: 0, commission_total: 0, lines: [], ...o,
}];

// Moyens de paiement publics d'AMAZER (tels qu'affichés sur le site).
const payMethods = [/\/payment-methods$/, [{ code: "nita", name: "Nita Transfert", kind: "manual", account_number: "+227 96953163", account_name: null, instructions: null }, { code: "amana", name: "Amana Transfert", kind: "amana", account_number: "+227 96953163", account_name: null, instructions: null }]];

// ---------- Client ----------
const clientOrders = [
  { id: "c1", tracking_code: "AMZ-4821", status: "livraison", payment_status: "paid", payment_mode: "nita", total_amount: 14500, currency: "XOF", created_at: iso(180), delivery_address: "Quartier Plateau, près de la pharmacie", items: [{ id: "ci1", product_id: "x1", product_name: "Sac à main en cuir", quantity: 1, unit_price: 12500 }] },
  { id: "c2", tracking_code: "AMZ-4710", status: "recu", payment_status: "paid", payment_mode: "amana", total_amount: 6000, currency: "XOF", created_at: iso(5000), delivery_address: "Quartier Plateau", items: [{ id: "ci2", product_id: "x2", product_name: "Pagne wax 6 yards", quantity: 1, unit_price: 5000 }] },
];
// Commande créée pendant la démonstration (rien n'est envoyé au vrai site).
const newOrder = { id: "c9", status: "payment_pending", payment_mode: "nita", delivery_type: "standard", payment_reference: "AMZ5120", payment_status: "pending", payment_confirmed_at: null, transaction_code: null, tracking_code: "AMZ-5120", estimated_minutes: 120, total_amount: 7000, currency: "XOF", created_at: iso(1), delivery_address: "Plateau, rue de la pharmacie", items: [{ id: "n1", product_id: "x3", product_name: "Parfum", quantity: 1, unit_price: 6000 }] };
export const client = {
  user: true,
  proxy: true,
  forward: /\/orders\/quote$/,
  onWrite(url) {
    if (url.endsWith("/orders/checkout")) return newOrder;
    if (url.includes("/orders/c9/payment")) return { order_id: "c9", payment_status: "pending", order_status: "payment_pending", message: "Paiement envoyé : AMAZER le vérifie." };
    return {};
  },
  mocks: [[/\/orders\/c9\/payment-intent$/, { order_id: "c9", payment_mode: "nita", payment_reference: "AMZ5120", amount: 7000, currency: "XOF", payment_url: "", qr_payload: "AMZ5120", expires_in_seconds: 86400, method_name: "Nita Transfert", method_kind: "manual", account_number: "+227 96953163", account_name: null, instructions: null, platform_wallet_phone: "+227 96953163" }], [/\/orders\/c9$/, newOrder], [/\/orders\/c9\/receipt-link$/, { order_id: "c9", token: "demo" }], me("aicha@exemple.com", "Aïcha Mahamadou"), [/\/restaurant\/orders\/me$/, []], [/\/api\/v1\/orders\/me$/, clientOrders], [/\/seller\/my-bookings$/, []], [/\/seller\/profile$/, null]],
};
export const visiteur = { proxy: true, mocks: [] };

// ---------- Boutique ----------
const names = ["Sac à main en cuir", "Pagne wax 6 yards", "Chaussures homme", "Parfum 100 ml", "Montre classique", "Robe de soirée", "Casque audio", "Savon karité"];
const shopProducts = names.map((n, i) => ({
  price_id: `p${i}`, product_id: `prod${i}`, product_name: n, brand: "Bella Mode", description: "Belle qualité, livré à domicile.", main_image_url: null, category_id: null,
  amount: [12500, 5000, 15000, 9000, 18000, 22000, 11000, 1500][i], currency: "XOF", stock_quantity: i === 3 ? 2 : 25, is_active: i !== 6, promo_price: i === 1 ? 4500 : null, promo_until: i === 1 ? iso(-7 * 1440) : null,
}));
const shopOrders = [
  { id: "o1", tracking_code: "AMZ-5102", customer_name: "Aïcha", status: "commande", payment_status: "paid", total_amount: 12500, payment_mode: "nita", created_at: iso(12), items: [{ id: "i1", product_id: "prod0", product_name: "Sac à main en cuir", quantity: 1, unit_price: 12500 }] },
  { id: "o2", tracking_code: "AMZ-5098", customer_name: "Moussa", status: "preparation", payment_status: "paid", total_amount: 30000, payment_mode: "amana", created_at: iso(95), items: [{ id: "i2", product_id: "prod2", product_name: "Chaussures homme", quantity: 2, unit_price: 15000 }] },
];
export const boutique = {
  user: true,
  mocks: [
    me("bella@exemple.com", "Bella Mode"),
    [/\/seller\/profile$/, { id: "sp1", vendor_id: "v1", business_name: "Bella Mode", activity_type: "shop", storefront_tier: "basic", offers_shop: true, offers_restaurant: false, city: "Niamey", phone: "+22790000001", address: "Grand marché" }],
    [/\/seller\/inventory$/, shopProducts],
    [/\/seller\/orders$/, shopOrders],
    stats, subscription, categories, payMethods, plan("shop", 2000),
  ],
};

// ---------- Restaurant ----------
const dish = (id, name, category, price, extra = {}) => ({ id, vendor_id: "v1", vendor_name: "Chez Awa", name, description: "Servi avec sauce maison et légumes frais.", image_url: null, base_price: price, currency: "XOF", tags: [], options: [], estimated_prep_minutes: 20, is_available: true, category, sort_order: 0, sold_out: false, ...extra });
const menu = [
  dish("d1", "Riz sauce arachide", "Plats", 1500, { tags: ["Plat du jour"], options: [{ name: "Supplément viande", price: 500 }, { name: "Sans piment", price: 0 }] }),
  dish("d2", "Poulet braisé", "Grillades", 3500),
  dish("d3", "Brochettes de bœuf", "Grillades", 2000, { sold_out: true }),
  dish("d4", "Jus de bissap", "Boissons", 500),
  dish("d5", "Thiéboudienne", "Plats", 2000),
];
const base = { logo_url: null, cover_image_url: null, opening_hours: null, whatsapp_contact: null, contact_email: null, gallery_images: [], service_offerings: [], room_types: [], deposit_payment_method: null, deposit_amount: null, payout_phone: null, effective_commission_rate: 0, effective_service_fee: 0, accepts_table_reservations: false, accepts_hotel_bookings: false, offers_transport: false, offers_shop: false, offers_restaurant: false, is_verified: true, products: [], restaurant_menu: [] };
const resto = { ...base, vendor_id: "v1", vendor_slug: "chez-awa", business_name: "Chez Awa", activity_type: "restaurant", storefront_tier: "basic", city: "Niamey", address: "Plateau", phone: "+22790000001", description: "Cuisine nigérienne", offers_restaurant: true, restaurant_menu: menu, restaurant_is_open: true, restaurant_open_label: "Ouvert jusqu'à 22:00", rating_average: 4.3, rating_count: 3 };
const rOrder = (id, status, minAgo, paid = true) => ({ id, vendor_id: "v1", vendor_name: "Chez Awa", customer_name: "Moussa", customer_phone: "+22790000002", delivery_address: "Quartier Recasement, près de la mosquée", distance_km: 3, delivery_fee: 1000, delivery_minutes: 35, payment_mode: "nita", payment_reference: `AMZ${id}XYZ`, payment_status: paid ? "paid" : "pending", status, total_amount: 4700, currency: "XOF", created_at: iso(minAgo), items: [{ id: `${id}i`, menu_item_id: "d1", dish_name: "Riz sauce arachide", quantity: 2, selected_options: [{ name: "Supplément viande", price: 500 }], customer_note: "Bien chaud svp", unit_price: 2000, subtotal: 4000 }] });
const reviews = { average: 4.3, count: 3, distribution: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 2 }, items: [
  { id: "r1", author: "Aïcha M.", rating: 5, comment: "Très bon riz, livré chaud et rapide.", reply: "Merci Aïcha, à bientôt !", created_at: iso(3000), is_mine: false },
  { id: "r2", author: "Ibrahim S.", rating: 3, comment: "Bon mais un peu long.", reply: null, created_at: iso(9000), is_mine: false },
] };
export const restaurant = {
  user: true,
  mocks: [
    me("awa@exemple.com", "Awa"),
    [/\/seller\/storefront\/v1$/, resto],
    [/\/seller\/storefront\/v1\/reviews$/, reviews],
    [/\/seller\/profile$/, { id: "sp1", vendor_id: "v1", business_name: "Chez Awa", activity_type: "restaurant", storefront_tier: "basic", offers_restaurant: true, city: "Niamey" }],
    [/\/restaurant\/seller\/menu$/, menu],
    [/\/restaurant\/seller\/orders$/, [rOrder("o1", "commande", 4), rOrder("o2", "commande", 52), rOrder("o4", "preparation", 15)]],
    [/\/restaurant\/seller\/settings$/, { weekly_hours: null, orders_paused: false, is_open: true, open_label: "Ouvert" }],
    [/\/restaurant\/(restaurants|list|places)/, { items: [resto], cities: [{ city: "Niamey", count: 1 }] }],
    stats, subscription, categories, payMethods, plan("restaurant", 5000),
  ],
};

// ---------- Hôtel ----------
const rooms = [
  { id: "std", name: "Chambre Standard", description: "Lit double, salle de bain privée, climatisation.", night_price: 25000, capacity: 2, room_count: 6, amenities: ["Climatisée", "Wi-Fi", "TV"], photo_urls: [], deposit_amount: null },
  { id: "suite", name: "Suite Fleuve", description: "Vue sur le fleuve, salon séparé.", night_price: 60000, capacity: 4, room_count: 1, amenities: ["Petit-déjeuner", "Balcon"], photo_urls: [], deposit_amount: null },
];
const hotelFront = { ...base, vendor_id: "h1", vendor_slug: "hotel-du-fleuve", business_name: "Hôtel du Fleuve", activity_type: "hotel", storefront_tier: "premium", city: "Niamey", address: "Corniche", phone: "+22790000003", description: "Hôtel au bord du fleuve", room_types: rooms, deposit_payment_method: "nita", payout_phone: "+22790000003", accepts_hotel_bookings: true };
const booking = (id, status, start, nights, name) => ({ id, vendor_id: "h1", room_type_id: "std", room_snapshot: { name: "Chambre Standard" }, guest_name: name, guest_phone: "+22790000004", guest_email: null, check_in_date: day(start), check_out_date: day(start + nights), guest_count: 2, deposit_payment_method: "nita", deposit_amount: 25000 * nights, payment_status: status === "pending" ? "pending" : "paid", transaction_reference: "NT123", special_request: status === "pending" ? "Arrivée vers 22 h" : null, status, created_at: iso() });
export const hotel = {
  user: true,
  mocks: [
    me("hotel@exemple.com", "Hôtel du Fleuve"),
    [/\/seller\/storefront\/h1$/, hotelFront],
    [/\/seller\/storefront\/h1\/availability$/, { check_in_date: day(0), check_out_date: day(1), nights: 1, available: { std: 2, suite: 0 } }],
    [/\/seller\/profile$/, { id: "sp1", vendor_id: "h1", business_name: "Hôtel du Fleuve", activity_type: "hotel", storefront_tier: "premium", accepts_hotel_bookings: true, offers_transport: false, room_types: rooms, city: "Niamey" }],
    [/\/seller\/hotel-bookings$/, [booking("b1", "pending", 2, 3, "Aïcha Mahamadou"), booking("b2", "confirmed", 0, 2, "Ibrahim Souley"), booking("b3", "checked_in", -1, 3, "Mariam Issa")]],
    stats, subscription, categories, payMethods, plan("premium", 10000),
  ],
};

// ---------- Transport ----------
const trips = [
  { id: "nm", name: "Niamey → Maradi", description: null, night_price: 12000, capacity: 50, room_count: 1, amenities: ["Climatisé", "Bagages inclus"], photo_urls: [], deposit_amount: null, departure_times: ["06:00", "14:00"], available_days: [day(1), day(2), day(4)] },
  { id: "nz", name: "Niamey → Zinder", description: null, night_price: 18000, capacity: 50, room_count: 1, amenities: ["Climatisé"], photo_urls: [], deposit_amount: null, departure_times: ["05:30"], available_days: [] },
];
const transportFront = { ...base, vendor_id: "t1", vendor_slug: "sahel-voyages", business_name: "Sahel Voyages", activity_type: "transport", storefront_tier: "premium", city: "Niamey", address: "Gare routière", phone: "+22790000005", description: "Cars climatisés", room_types: trips, deposit_payment_method: "nita", payout_phone: "+22790000005", accepts_hotel_bookings: true, offers_transport: true };
const seat = (id, status, offset, time, name, seats) => ({ id, vendor_id: "t1", room_type_id: "nm", room_snapshot: { name: "Niamey → Maradi" }, guest_name: name, guest_phone: "+22790000006", guest_email: null, check_in_date: day(offset), check_out_date: day(offset + 1), guest_count: seats, deposit_payment_method: "nita", deposit_amount: 12000 * seats, payment_status: status === "pending" ? "pending" : "paid", transaction_reference: "NT55", special_request: null, status, created_at: iso(), departure_time: time });
export const transport = {
  user: true,
  mocks: [
    me("voyages@exemple.com", "Sahel Voyages"),
    [/\/seller\/storefront\/t1$/, transportFront],
    [/\/seller\/storefront\/t1\/seats$/, { trip_id: "nm", day: day(1), seats_left: { "06:00": 3, "14:00": 47 } }],
    [/\/seller\/profile$/, { id: "sp1", vendor_id: "t1", business_name: "Sahel Voyages", activity_type: "transport", storefront_tier: "premium", accepts_hotel_bookings: true, offers_transport: true, offers_shop: false, room_types: trips, city: "Niamey" }],
    [/\/seller\/hotel-bookings$/, [seat("p1", "confirmed", 1, "06:00", "Hadiza Ali", 2), seat("p2", "pending", 1, "06:00", "Saidou Amadou", 1), seat("p4", "confirmed", 2, "14:00", "Issa Garba", 3)]],
    [/\/seller\/my-bookings$/, [{ id: "p1", kind: "transport", vendor_id: "t1", place_name: "Sahel Voyages", item_name: "Niamey → Maradi", check_in_date: day(1), check_out_date: day(2), departure_time: "06:00", guest_count: 2, amount: 24000, status: "confirmed", payment_status: "paid", ticket_token: "p1.0123456789abcdef0123456789abcdef", created_at: iso() }]],
    [/\/api\/v1\/orders\/me$/, []],
    stats, subscription, categories, payMethods, plan("premium", 10000),
  ],
};

// ---------- Pharmacie ----------
const svc = (o) => ({ vendor_id: "x", vendor_slug: "x", service_kind: "pharmacy", business_name: "Pharmacie", city: "Niamey", address: null, phone: "+22790000001", whatsapp_contact: null, logo_url: null, is_verified: false, latitude: null, longitude: null, maps_url: "https://www.google.com/maps/search/?api=1&query=Niamey", delivery_phone: "+22790000099", on_duty: false, duty_label: null, fuel: {}, fuel_fresh: false, fuel_updated_at: null, ...o });
const pharmacies = {
  items: [
    svc({ vendor_id: "ph1", business_name: "Pharmacie du Fleuve", address: "Rond-point Kennedy", is_verified: true, on_duty: true, duty_label: "De garde cette semaine", latitude: 13.515, longitude: 2.112 }),
    svc({ vendor_id: "ph2", business_name: "Pharmacie Yantala", address: "Yantala haut", on_duty: true, duty_label: "De garde", latitude: 13.53, longitude: 2.08 }),
    svc({ vendor_id: "ph3", business_name: "Pharmacie Centrale de Maradi", city: "Maradi", address: "Grand marché", delivery_phone: null }),
  ],
  cities: [{ city: "Niamey", count: 2 }, { city: "Maradi", count: 1 }],
  delivery_cities: ["Niamey"],
  fresh_hours: 6,
};
const pharmaFront = { ...base, vendor_id: "ph1", vendor_slug: "fleuve", business_name: "Pharmacie du Fleuve", activity_type: "enterprise", storefront_tier: "premium", city: "Niamey", address: "Rond-point Kennedy", phone: "+22790000001", description: "Pharmacie de quartier, conseils et parapharmacie.", opening_hours: "8 h – 22 h", local_service: pharmacies.items[0] };
export const pharmacie = {
  user: true,
  mocks: [
    me("pharmacie@exemple.com", "Pharmacie du Fleuve"),
    [/\/services\/pharmacies$/, pharmacies],
    [/\/seller\/service-status$/, { service_kind: "pharmacy", on_duty: false, on_duty_now: true, duty_start: day(-1), duty_end: day(5), duty_label: "De garde cette semaine", fuel: {}, fuel_fresh: false, fuel_updated_at: null, latitude: 13.515, longitude: 2.112, maps_url: "https://www.google.com/maps", delivery_phone: "+22790000099" }],
    [/\/seller\/storefront\/ph1$/, pharmaFront],
    [/\/seller\/profile$/, { id: "sp1", vendor_id: "ph1", business_name: "Pharmacie du Fleuve", activity_type: "enterprise", storefront_tier: "premium", service_kind: "pharmacy", offers_shop: false, room_types: [], city: "Niamey" }],
    [/\/api\/v1\/orders\/me$/, []],
    stats, subscription, categories, payMethods, plan("pharmacy", 10000, { plan: "subscribed", in_trial: false }),
  ],
};
export const pharmaClient = { proxy: true, mocks: [[/\/services\/pharmacies$/, pharmacies]] };

// ---------- Revendeur ----------
const listings = [
  { id: "l1", price_id: "p0", product_id: "prod0", product_name: "Sac à main en cuir", image_url: null, supplier_amount: 12500, resale_amount: 14000, margin: 1500, in_stock: true, is_active: true, sales_count: 4 },
  { id: "l2", price_id: "p1", product_id: "prod1", product_name: "Pagne wax 6 yards", image_url: null, supplier_amount: 5000, resale_amount: 6000, margin: 1000, in_stock: true, is_active: true, sales_count: 9 },
  { id: "l3", price_id: "p3", product_id: "prod3", product_name: "Parfum 100 ml", image_url: null, supplier_amount: 9000, resale_amount: 10500, margin: 1500, in_stock: true, is_active: false, sales_count: 0 },
];
export const revendeur = {
  user: true,
  proxy: true,
  mocks: [
    me("ali@exemple.com", "Ali Garba"),
    [/\/resellers\/account\/me$/, { active: true, paid_until: iso(-25 * 1440), monthly_fee: 1000, commission_percent: 0, pending_payment: false }],
    [/\/resellers\/listings\/me$/, listings],
    [/\/resellers\/earnings\/me$/, { earned: 15000, pending: 3000, orders_delivered: 13, orders_pending: 2, paid: 12000, to_pay: 3000 }],
    [/\/resellers\/u1\/shop$/, { reseller_id: "u1", reseller_name: "Ali Garba", active: true, items: listings.filter((l) => l.is_active).map((l) => ({ id: l.id, price_id: l.price_id, vendor_id: "v1", product_id: l.product_id, product_name: l.product_name, image_url: null, price: l.resale_amount })) }],
    [/\/seller\/profile$/, null],
  ],
};

// ---------- Affilié ----------
const affMe = {
  code: "K7M4QA", tier: "ambassador", status: "active", seller_share_percent: 20, seller_share_months: 12, customer_bonus: 250, hold_days: 30, min_payout: 2000, clicks: 184, referred_sellers: 7, referred_customers: 23,
  earnings: { earned: 31750, pending: 750, in_progress: 750, on_hold: 6500, review: 1000, available: 14250, requested: 0, paid: 10000, from_sellers: 26000, from_customers: 3750, from_bonus: 2000, orders_delivered: 15, orders_pending: 3 },
  ambassador: { first_month_percent: 50, current_percent: 20, paying_shops: 7, next_tier_shops: 10, next_tier_percent: 25, monthly_top_bonus: 10000 },
  ambassador_applied: false, payout_method: "nita", payout_phone: "+22790000001",
  recent_earnings: [
    { id: "e1", label: "Abonnement d'un vendeur parrainé", amount: 2500, status: "pending", note: null, created_at: iso(), available_at: iso(-20 * 1440) },
    { id: "e2", label: "Nouveau client (1re commande livrée)", amount: 250, status: "available", note: null, created_at: iso(), available_at: iso() },
  ],
  payouts: [{ id: "p1", amount: 10000, method: "nita", phone: "+22790000001", status: "paid", transaction_reference: "NT2610010042", admin_note: null, created_at: iso(), processed_at: iso() }],
};
export const affilie = {
  user: true,
  mocks: [
    me("fatima@exemple.com", "Fatima Issa"),
    [/\/affiliates\/me$/, affMe],
    [/\/affiliates\/leaderboard$/, { month: "2026-11", top_bonus: 10000, rows: [{ rank: 1, name: "Fatima I.", new_shops: 5, is_me: true }, { rank: 2, name: "Awa M.", new_shops: 3, is_me: false }, { rank: 3, name: "Ali", new_shops: 1, is_me: false }] }],
  ],
};

// ---------- Livreur ----------
const pickup = (shop, items, address = "Grand marché") => ({ shop_name: shop, address, city: "Niamey", phone: "+22790000011", whatsapp: null, opening_hours: "8 h – 20 h", maps_url: "https://www.google.com/maps", status: "preparation", status_label: "En préparation", items });
const delivery = (id, code, district, total, fee, mine, extra = {}) => ({ id, tracking_code: code, status: mine ? "livraison" : "preparation", created_at: iso(40), delivery_type: "standard", district, total_amount: total, payment_status: "paid", item_count: 1, delivery_fee: fee, deliver_before: iso(-120), pickups: [pickup("Bella Mode", ["1 × Sac à main en cuir"])], customer_name: "Aïcha", customer_phone: mine ? "+22790000012" : null, delivery_address: mine ? "Plateau, rue de la pharmacie, porte bleue" : null, customer_maps_url: mine ? "https://www.google.com/maps" : null, assigned_to_me: mine, courier_assigned_at: mine ? iso(10) : null, delivered_at: null, ...extra });
const courierState = {
  available: [delivery("k1", "AMZ-5102", "Plateau", 12500, 1000, false), delivery("k2", "AMZ-5110", "Yantala", 6000, 1500, false, { pickups: [pickup("Chez Awa", ["2 × Riz sauce arachide"], "Plateau")] })],
  mine: [delivery("k3", "AMZ-5090", "Recasement", 30000, 1500, true)],
};
export const livreur = {
  user: true,
  mocks: [
    me("issa@exemple.com", "Issa Livreur", "courier"),
    [/\/courier\/orders\/available$/, () => courierState.available],
    [/\/courier\/orders\/mine$/, () => courierState.mine],
  ],
  onWrite(url) {
    const id = url.split("/orders/")[1]?.split("/")[0];
    if (url.endsWith("/take")) {
      const i = courierState.available.findIndex((o) => o.id === id);
      if (i >= 0) {
        const [o] = courierState.available.splice(i, 1);
        Object.assign(o, { assigned_to_me: true, status: "livraison", customer_phone: "+22790000012", delivery_address: "Plateau, rue de la pharmacie, porte bleue", customer_maps_url: "https://www.google.com/maps", courier_assigned_at: iso() });
        courierState.mine.unshift(o);
        return o;
      }
    }
    if (url.endsWith("/delivered")) {
      const o = courierState.mine.find((x) => x.id === id);
      if (o) Object.assign(o, { status: "recu", delivered_at: iso() });
      return o ?? {};
    }
    return {};
  },
};
