// Données fictives de démonstration pour les vidéos : marque inventée, aucun vrai client.
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
const H = 60;
const D = 24 * 60;
const VENDOR = "v-sahel";
const maps = (lat, lng, name) =>
  lat == null ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}` : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
const info = (o) => ({
  address: null, phone: null, opening_hours: null, services: [], latitude: null, longitude: null, info_updated_at: null, ...o,
  maps_url: maps(o.latitude ?? null, o.longitude ?? null, o.address ?? "Niger"),
});
const mgr = (id, email, full_name) => ({ id, email, full_name });

// ── Stations Sahel Énergie : Niamey (4), Maradi (2), Zinder (1 fermée) ─────────────
const stations = [
  { id: "st-plateau", name: "Sahel Énergie Plateau", city: "Niamey", is_active: true, fuel: { super: "available", gasoil: "available", gaz: "available" }, fuel_fresh: true, fuel_updated_at: ago(25),
    info: info({ address: "Avenue de la Mairie, Plateau", phone: "+227 20 73 41 10", opening_hours: "24 h/24", services: ["lavage", "gonflage", "boutique", "mobile_money"], latitude: 13.5137, longitude: 2.1098, info_updated_at: ago(3 * D) }),
    managers: [mgr("m1", "aichatou.issa@gmail.com", "Aïchatou Issa")], open_reports: 0, calls_30d: 64, routes_30d: 212, gas_orders_30d: 18 },
  { id: "st-yantala", name: "Sahel Énergie Yantala", city: "Niamey", is_active: true, fuel: { super: "available", gasoil: "out", gaz: "low" }, fuel_fresh: false, fuel_updated_at: ago(31 * H),
    info: info({ address: "Route de Ouallam, Yantala haut", phone: "+227 96 12 34 56", opening_hours: "6 h – 23 h", services: ["gonflage", "toilettes"], info_updated_at: ago(12 * D) }),
    managers: [mgr("m2", "souley.harouna@yahoo.fr", "Souleymane Harouna"), mgr("m1b", "aichatou.issa@gmail.com", "Aïchatou Issa")], open_reports: 2, calls_30d: 21, routes_30d: 88, gas_orders_30d: 4 },
  { id: "st-liberte", name: "Sahel Énergie Rond-point Liberté", city: "Niamey", is_active: true, fuel: { super: "low", gasoil: "available", gaz: "out" }, fuel_fresh: true, fuel_updated_at: ago(140),
    info: info({ address: "Rond-point Liberté", latitude: 13.5302, longitude: 2.0874 }),
    managers: [], open_reports: 1, calls_30d: 37, routes_30d: 145, gas_orders_30d: 9 },
  { id: "st-tillaberi", name: "Sahel Énergie Route de Tillabéri", city: "Niamey", is_active: true, fuel: { super: "available", gasoil: "available", gaz: "out" }, fuel_fresh: true, fuel_updated_at: ago(55),
    info: info({ address: "Route de Tillabéri, Koira Tegui", phone: "+227 90 45 67 89", opening_hours: "5 h 30 – 22 h", services: ["lavage", "vidange", "atelier", "carte"], latitude: 13.5711, longitude: 2.0652, info_updated_at: ago(D) }),
    managers: [mgr("m3", "moussa.garba@gmail.com", "Moussa Garba"), mgr("m4", "hadiza.oumarou@gmail.com", "Hadiza Oumarou")], open_reports: 0, calls_30d: 29, routes_30d: 97, gas_orders_30d: 0 },
  { id: "st-maradi-centre", name: "Sahel Énergie Maradi Centre", city: "Maradi", is_active: true, fuel: { super: "available", gasoil: "low", gaz: "available" }, fuel_fresh: true, fuel_updated_at: ago(3 * H),
    info: info({ address: "Boulevard de la Paix, face au grand marché", phone: "+227 20 41 05 22", opening_hours: "6 h – 22 h", services: ["boutique", "toilettes", "mobile_money"], latitude: 13.5005, longitude: 7.1017, info_updated_at: ago(6 * D) }),
    managers: [mgr("m5", "ibrahim.moussa@gmail.com", "Ibrahim Moussa")], open_reports: 1, calls_30d: 18, routes_30d: 61, gas_orders_30d: 7 },
  { id: "st-maradi-kano", name: "Sahel Énergie Maradi Route de Kano", city: "Maradi", is_active: true, fuel: { super: "available", gasoil: "available", gaz: null }, fuel_fresh: false, fuel_updated_at: ago(4 * D),
    info: info({ address: "Sortie sud, route de Kano" }),
    managers: [], open_reports: 0, calls_30d: 6, routes_30d: 23, gas_orders_30d: 0 },
  { id: "st-zinder", name: "Sahel Énergie Zinder Birni", city: "Zinder", is_active: false, fuel: { super: null, gasoil: null, gaz: null }, fuel_fresh: false, fuel_updated_at: ago(40 * D),
    info: info({ address: "Quartier Birni, près de la grande mosquée", phone: "+227 20 51 03 33", opening_hours: "Fermée pour travaux", services: ["gonflage"], latitude: 13.8062, longitude: 8.9881 }),
    managers: [], open_reports: 0, calls_30d: 0, routes_30d: 2, gas_orders_30d: 0 },
];
const byId = Object.fromEntries(stations.map((s) => [s.id, s]));
// FuelOutletResponse (backend/app/schemas/local_services.py)
const outletResponse = (s) => ({
  id: s.id, name: s.name, city: s.city, address: s.info.address, phone: s.info.phone, is_active: s.is_active, latitude: s.info.latitude, longitude: s.info.longitude,
  maps_url: s.info.maps_url, delivery_phone: s.fuel.gaz ? "+227 90 00 11 22" : null, fuel: s.fuel, fuel_fresh: s.fuel_fresh, fuel_updated_at: s.fuel_updated_at,
  calls_30d: s.calls_30d, routes_30d: s.routes_30d, gas_orders_30d: s.gas_orders_30d, info: s.info, managers: s.managers, open_reports: s.open_reports,
});
// RegionStation (backend/app/schemas/station_space.py)
const regionStation = (s) => ({
  id: s.id, name: s.name, city: s.city, is_active: s.is_active, fuel: s.fuel, fuel_fresh: s.fuel_fresh, fuel_updated_at: s.fuel_updated_at, info: s.info,
  managers: s.managers, open_reports: s.open_reports, calls_30d: s.calls_30d, routes_30d: s.routes_30d, gas_orders_30d: s.gas_orders_30d,
});
// ManagedOutlet
const managedOutlet = (s, role, via_region = null) => ({
  id: s.id, name: s.name, brand_name: "Sahel Énergie", city: s.city, fuel: s.fuel, fuel_fresh: s.fuel_fresh, fuel_updated_at: s.fuel_updated_at, can_update: true,
  fresh_hours: 6, via_region, info: s.info, open_reports: s.open_reports, role,
});

// ── Journal d'activité : tous les rôles et toutes les actions ──────────────
const act = (id, min, role, action, actor_name, outletRef, detail, city) => {
  const s = outletRef ? byId[outletRef] : null;
  return {
    id, created_at: ago(min), role, action, detail, actor_name,
    outlet_id: s ? s.id : null, outlet_name: s ? s.name : outletRef ?? null, city: s ? s.city : city ?? null,
  };
};
const activity = [
  act("a1", 25, "manager", "fuel", "Aïchatou Issa", "st-plateau", "Super : disponible · Gasoil : disponible · Gaz : disponible"),
  act("a2", 55, "manager", "confirm", "Moussa Garba", "st-tillaberi", "Rien n'a changé"),
  act("a3", 140, "city", "fuel", "Ibrahim Moussa", "st-liberte", "Super : stock faible · Gaz : rupture"),
  act("a4", 3 * H, "manager", "delivery", "Ibrahim Moussa", "st-maradi-centre", "Livraison Gasoil 15 000 L (bon BL-2291)"),
  act("a5", 5 * H, "manager", "report_resolved", "Aïchatou Issa", "st-plateau", "Retour traité : prix affiché corrigé"),
  act("a6", 8 * H, "city", "manager_added", "Ibrahim Moussa", "st-tillaberi", "Gérant ajouté : hadiza.oumarou@gmail.com"),
  act("a7", 22 * H, "manager", "position", "Moussa Garba", "st-tillaberi", "Position enregistrée sur place"),
  act("a8", 26 * H, "manager", "info", "Moussa Garba", "st-tillaberi", "Horaires et services modifiés"),
  act("a9", 30 * H, "owner", "outlet_created", "Direction Sahel Énergie", "st-maradi-kano", "Station ajoutée à Maradi"),
  act("a10", 2 * D, "owner", "city_added", "Direction Sahel Énergie", null, "Responsable de ville ajouté : ibrahim.moussa@gmail.com", "Niamey"),
  act("a11", 3 * D, "city", "outlet_closed", "Ibrahim Moussa", "st-zinder", "Station fermée pour travaux"),
  act("a12", 4 * D, "city", "manager_removed", "Ibrahim Moussa", "st-yantala", "Gérant retiré : ali.mahamadou@gmail.com"),
  act("a13", 5 * D, "owner", "outlet_deleted", "Direction Sahel Énergie", "Sahel Énergie Dosso Entrée", "Station supprimée", "Dosso"),
  act("a14", 6 * D, "owner", "city_removed", "Direction Sahel Énergie", null, "Responsable de ville retiré : zinder.resp@gmail.com", "Zinder"),
  act("a15", 7 * D, "owner", "outlet_opened", "Direction Sahel Énergie", "st-maradi-centre", "Station ouverte"),
  act("a16", 8 * D, "manager", "fuel", "Souleymane Harouna", "st-yantala", "Gasoil : rupture · Gaz : stock faible"),
  act("a17", 9 * D, "manager", "delivery", "Aïchatou Issa", "st-plateau", "Livraison Super 20 000 L (bon 4471)"),
  ...Array.from({ length: 30 }, (_, i) =>
    act(`b${i}`, (10 + i * 0.6) * D, i % 3 === 0 ? "city" : "manager", i % 2 ? "confirm" : "fuel", i % 3 === 0 ? "Ibrahim Moussa" : "Aïchatou Issa",
      i % 2 ? "st-plateau" : "st-liberte", i % 2 ? "Rien n'a changé" : "Super : disponible")),
];

// ── Livraisons et retours clients ──────────────────────────────────────────
const dl = (id, outletId, fuel, liters, reference, min, recorded_by) =>
  ({ id, outlet_id: outletId, outlet_name: byId[outletId].name, fuel, liters, reference, delivered_at: ago(min), recorded_by });
const deliveries = [
  dl("d1", "st-maradi-centre", "gasoil", 15000, "BL-2291", 3 * H, "Ibrahim Moussa"),
  dl("d3", "st-tillaberi", "gaz", 120, null, 2 * D, "Moussa Garba"),
  dl("d2", "st-plateau", "super", 20000, "4471 / camion NG-2231", 9 * D, "Aïchatou Issa"),
  dl("d4", "st-yantala", "gasoil", 18000, "SONIDEP 88213", 11 * D, "Souleymane Harouna"),
  dl("d5", "st-liberte", "super", 12500, null, 15 * D, "Ibrahim Moussa"),
  dl("d6", "st-plateau", "gasoil", 25000, "BL-2210", 21 * D, "Aïchatou Issa"),
];
const rp = (id, outletId, kind, comment, min, resolved) => ({
  id, outlet_id: outletId, outlet_name: outletId ? byId[outletId].name : null, kind, comment, created_at: ago(min),
  resolved_at: resolved ? ago(resolved[0]) : null, resolution: resolved ? resolved[1] : null, resolved_by_name: resolved ? resolved[2] : null,
});
const reports = [
  rp("r1", "st-yantala", "wrong_status", "Affiché gasoil disponible mais la pompe est vide depuis ce matin.", 4 * H, null),
  rp("r2", "st-yantala", "other", "Longue file d'attente, une seule pompe ouverte.", 20 * H, null),
  rp("r3", "st-liberte", "wrong_place", "La position sur la carte mène derrière le marché.", 2 * D, null),
  rp("r4", "st-maradi-centre", "closed", null, 3 * D, null),
  rp("r5", "st-plateau", "wrong_status", "Le prix du super affiché n'est pas le bon.", 6 * D, [5 * H, "Prix affiché corrigé, merci.", "Aïchatou Issa"]),
  rp("r6", null, "other", "Pourquoi pas de station Sahel Énergie à Tahoua ?", 9 * D, [8 * D, "Ouverture prévue en 2027.", "Direction Sahel Énergie"]),
];

// ── Propriétaire : tableau de bord, responsables, palier, réseau ───────────
const dashboard = {
  stations: 7, fresh: 4, to_confirm: 2, without_manager: 3, reports_30d: 6,
  stale: [
    { id: "st-yantala", name: "Sahel Énergie Yantala", city: "Niamey", fuel_updated_at: ago(31 * H) },
    { id: "st-maradi-kano", name: "Sahel Énergie Maradi Route de Kano", city: "Maradi", fuel_updated_at: ago(4 * D) },
  ],
  long_outages: [
    { id: "st-yantala", name: "Sahel Énergie Yantala", city: "Niamey", fuel: "gasoil", since: ago(31 * H) },
    { id: "st-liberte", name: "Sahel Énergie Rond-point Liberté", city: "Niamey", fuel: "gaz", since: ago(2 * D) },
  ],
  cities: [
    { city: "Niamey", stations: 4, to_confirm: 1, out: 2, city_managers: ["Ibrahim Moussa"], calls_30d: 151, routes_30d: 542, without_manager: 1 },
    { city: "Maradi", stations: 2, to_confirm: 1, out: 0, city_managers: ["Zeinabou Abdou"], calls_30d: 24, routes_30d: 84, without_manager: 1 },
    { city: "Zinder", stations: 1, to_confirm: 0, out: 0, city_managers: [], calls_30d: 0, routes_30d: 2, without_manager: 1 },
  ],
  calls_30d: 175, routes_30d: 628, gas_orders_30d: 38, deliveries_30d: 6,
};
const regionManagers = [
  { id: "rm1", city: "Niamey", email: "ibrahim.moussa@gmail.com", full_name: "Ibrahim Moussa", stations: 4, last_activity_at: ago(140) },
  { id: "rm2", city: "Maradi", email: "zeinabou.abdou@gmail.com", full_name: "Zeinabou Abdou", stations: 2, last_activity_at: null },
];
const fuelPlan = { level: 2, name: "Réseau", stations: 7, network_from: 3, enterprise_from: 15, network_tools: true, export: false };
const fuelNetwork = { stations: 7, included: 3, base: 15000, extra: 8000, total: 23000, flat: 50000, capped: false, next_station_price: 2000, negotiated: null, with_gas: 5, to_confirm: 2 };
const fuelManagers = stations.flatMap((s) => s.managers.map((m) => ({ id: m.id, outlet_id: s.id, outlet_name: s.name, email: m.email, full_name: m.full_name })));
const serviceStatus = {
  service_kind: "fuel_station", on_duty: false, on_duty_now: false, duty_start: null, duty_end: null, duty_label: null, fuel: {}, fuel_fresh: false,
  fuel_updated_at: null, latitude: null, longitude: null, maps_url: "https://www.google.com/maps", delivery_phone: null,
};

// ── Responsable de ville (Niamey) ──────────────────────────────────────────
const niamey = stations.filter((s) => s.city === "Niamey");
const regionCityNiamey = {
  vendor_id: VENDOR, brand_name: "Sahel Énergie", city: "Niamey", can_update: true,
  totals: { stations: 4, fresh: 3, to_confirm: 1, out: 2, without_manager: 1, open_reports: 3, calls_30d: 151, routes_30d: 542, gas_orders_30d: 31 },
  stations: niamey.map(regionStation),
};

const user = (id, email, full_name) => ({ id, email, full_name, whatsapp_phone: null, is_active: true, role: "user", created_at: ago(200 * D) });
const common = [
  [/\/categories/, { items: [] }],
  [/\/affiliates\/me$/, { code: "OR7K2P", tier: "affiliate", status: "active", seller_share_percent: 20, seller_share_months: 12, customer_bonus: 250, hold_days: 30, min_payout: 2000, clicks: 0, referred_sellers: 0, referred_customers: 0, earnings: {}, ambassador: null, ambassador_applied: false, payouts: [] }],
  [/\/orders\/me$/, []],
  [/\/station-manager\/outlets\/[^/]+\/deliveries$/, (url) => deliveries.filter((d) => url.includes(`/outlets/${d.outlet_id}/`))],
  [/\/station-manager\/outlets\/[^/]+\/reports$/, (url) => reports.filter((r) => r.outlet_id && url.includes(`/outlets/${r.outlet_id}/`))],
  [/\/station-manager\/outlets\/[^/]+\/activity$/, (url) => activity.filter((a) => a.outlet_id && url.includes(`/outlets/${a.outlet_id}/`))],
  [/\/station-region\/activity$/, activity.filter((a) => a.city === "Niamey")],
  [/\/station-region\/reports$/, reports.filter((r) => r.outlet_id && byId[r.outlet_id].city === "Niamey")],
];

export const scenarios = {
  owner: {
    path: "/seller/dashboard",
    mocks: [
      [/\/auth\/me$/, user("u-owner", "direction@sahel.ne", "Direction Sahel Énergie")],
      [/\/station-space\/me$/, { is_owner: true, owner_brand: "Sahel Énergie", cities: 0, stations: 0 }],
      [/\/seller\/profile$/, { id: "sp1", user_id: "u-owner", vendor_id: VENDOR, business_name: "Sahel Énergie", activity_type: "enterprise", storefront_tier: "premium", service_kind: "fuel_station", offers_shop: false, offers_restaurant: false, room_types: [], gallery_images: [], service_offerings: [], city: "Niamey" }],
      [/\/seller\/subscription-status$/, { has_seller_profile: true, onboarding_fee_paid: true, onboarding_fee_paid_at: null, subscription_paid_until: ago(-20 * D), subscription_active: true, monthly_fee: 23000, onboarding_fee: 0, amount_due_now: 0, currency: "XOF", has_pending_payment_request: false }],
      [/\/seller\/service-status$/, serviceStatus],
      [/\/seller\/fuel-outlets$/, stations.map(outletResponse)],
      [/\/seller\/fuel-dashboard$/, dashboard],
      [/\/seller\/station-reports$/, reports],
      [/\/seller\/fuel-region-managers$/, regionManagers],
      [/\/seller\/fuel-managers$/, fuelManagers],
      [/\/seller\/fuel-plan$/, fuelPlan],
      [/\/seller\/fuel-network$/, fuelNetwork],
      [/\/seller\/fuel-activity$/, activity],
      [/\/seller\/fuel-deliveries$/, deliveries],
      [/\/seller\/fuel-history$/, []],
      ...common,
    ],
    steps: [
      ["initial", []],
      ["city-managers", ["Responsables par ville"]],
      ["stations", ["Stations par ville"]],
      ["stations-city", ["Stations par ville", "Niamey"]],
      ["stations-station", ["Stations par ville", "Niamey", "Sahel Énergie Yantala"]],
      ["stations-station-managers", ["Stations par ville", "Niamey", "Sahel Énergie Yantala", "Gérants"]],
      ["stations-station-info", ["Stations par ville", "Niamey", "Sahel Énergie Yantala", "Informations et horaires"]],
      ["stations-station-position", ["Stations par ville", "Niamey", "Sahel Énergie Yantala", "Position Google Maps"]],
      ["stations-zinder", ["Stations par ville", "Zinder", "Sahel Énergie Zinder Birni"]],
      ["stations-add", ["Stations par ville", "Ajouter une station"]],
      ["stations-bulk", ["Stations par ville", "Mise à jour groupée"]],
      ["activity", ["Activité"]],
      ["reports", ["Retours clients"]],
      ["deliveries", ["Livraisons"]],
      ["subscription", ["Abonnement et export"]],
      ["vitrine", ["Vitrine, avis et parrainage"]],
    ],
  },
  city: {
    path: "/gerant-station",
    mocks: [
      [/\/auth\/me$/, user("u-ibrahim", "ibrahim.moussa@gmail.com", "Ibrahim Moussa")],
      [/\/station-space\/me$/, { is_owner: false, owner_brand: null, cities: 1, stations: 1 }],
      [/\/station-region\/cities$/, [regionCityNiamey]],
      [/\/station-manager\/outlets$/, [...niamey.map((s) => managedOutlet(s, "city", "Niamey")), managedOutlet(byId["st-maradi-centre"], "manager")]],
      ...common,
    ],
    steps: [
      ["initial", []],
      ["city-open", ["Niamey"]],
      ["city-station", ["Niamey", "Stations", "Sahel Énergie Yantala"]],
      ["city-station-managers", ["Niamey", "Stations", "Sahel Énergie Yantala", "Gérants"]],
      ["city-station-info", ["Niamey", "Stations", "Sahel Énergie Yantala", "Infos et position"]],
      ["city-add", ["Niamey", "Stations", "Ajouter une station"]],
      ["city-activity", ["Niamey", "Activité des gérants"]],
      ["city-reports", ["Niamey", "Retours clients"]],
      ["city-summary", ["Niamey", "Résumé"]],
      ["managed-station", ["Sahel Énergie Maradi Centre"]],
      ["managed-deliveries", ["Sahel Énergie Maradi Centre", "Livraisons"]],
    ],
  },
  gerant: {
    path: "/gerant-station",
    mocks: [
      [/\/auth\/me$/, user("u-aichatou", "aichatou.issa@gmail.com", "Aïchatou Issa")],
      [/\/station-space\/me$/, { is_owner: false, owner_brand: null, cities: 0, stations: 2 }],
      [/\/station-region\/cities$/, []],
      [/\/station-manager\/outlets$/, [managedOutlet(byId["st-plateau"], "manager"), managedOutlet(byId["st-yantala"], "manager")]],
      ...common,
    ],
    steps: [
      ["initial", []],
      ["info", ["Sahel Énergie Plateau", "Informations et horaires"]],
      ["position", ["Sahel Énergie Plateau", "Position Google Maps"]],
      ["deliveries", ["Sahel Énergie Plateau", "Livraisons"]],
      ["history", ["Sahel Énergie Plateau", "Historique"]],
      ["reports", ["Sahel Énergie Yantala", "Retours clients"]],
    ],
  },
};

