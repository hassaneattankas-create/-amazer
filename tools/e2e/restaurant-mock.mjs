// Apercu restaurant (client + restaurateur) avec des donnees simulees (aucun appel reel au serveur).
import puppeteer from "puppeteer";

const out = process.argv[2];
const base = "http://localhost:3100";
const now = Date.now();
const iso = (minAgo) => new Date(now - minAgo * 60000).toISOString();
const dish = (id, name, category, price, extra = {}) => ({
  id, vendor_id: "v1", vendor_name: "Chez Awa", name, description: "Servi avec sauce maison et légumes frais.", image_url: null,
  base_price: price, currency: "XOF", tags: [], options: [], estimated_prep_minutes: 20, is_available: true, category, sort_order: 0, sold_out: false, ...extra,
});
const menu = [
  dish("d1", "Riz sauce arachide", "Plats", 1500, { tags: ["Plat du jour"], options: [{ name: "Supplément viande", price: 500 }, { name: "Sans piment", price: 0 }] }),
  dish("d2", "Poulet braisé", "Grillades", 3500),
  dish("d3", "Brochettes de bœuf", "Grillades", 2000, { sold_out: true }),
  dish("d4", "Jus de bissap", "Boissons", 500),
  dish("d5", "Thiéboudienne", "Plats", 2000),
];
const storefront = {
  vendor_id: "v1", vendor_slug: "chez-awa", business_name: "Chez Awa", activity_type: "restaurant", storefront_tier: "basic", city: "Niamey",
  address: "Plateau", phone: "+22790000001", description: "Cuisine nigérienne", logo_url: null, cover_image_url: null, opening_hours: null,
  whatsapp_contact: null, contact_email: null, gallery_images: [], service_offerings: [], room_types: [], deposit_payment_method: null,
  deposit_amount: null, payout_phone: null, effective_commission_rate: 0, effective_service_fee: 0, accepts_table_reservations: false,
  accepts_hotel_bookings: false, offers_transport: false, offers_shop: false, offers_restaurant: true, is_verified: true, products: [],
  restaurant_menu: menu, restaurant_is_open: true, restaurant_open_label: "Ouvert jusqu'à 22:00", rating_average: 4.3, rating_count: 3,
};
const order = (id, status, minAgo, paid = true) => ({
  id, vendor_id: "v1", vendor_name: "Chez Awa", customer_name: "Moussa", customer_phone: "+22790000002", delivery_address: "Quartier Recasement, près de la mosquée",
  distance_km: 3, delivery_fee: 1000, delivery_minutes: 35, payment_mode: "nita", payment_reference: `AMZ${id}XYZ`, payment_status: paid ? "paid" : "pending",
  status, total_amount: 4700, currency: "XOF", created_at: iso(minAgo),
  items: [{ id: `${id}i`, menu_item_id: "d1", dish_name: "Riz sauce arachide", quantity: 2, selected_options: [{ name: "Supplément viande", price: 500 }], customer_note: "Bien chaud svp", unit_price: 2000, subtotal: 4000 }],
});
const orders = [order("o1", "commande", 4), order("o2", "commande", 52), order("o3", "payment_pending", 2, false), order("o4", "preparation", 15)];
const mocks = [
  [/\/auth\/me$/, { id: "u1", email: "awa@example.test", full_name: "Awa", whatsapp_phone: null, is_active: true, role: "user", created_at: iso(9999) }],
  [/\/seller\/storefront\/v1$/, storefront],
  [/\/seller\/storefront\/v1\/reviews$/, { average: 4.3, count: 3, distribution: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 2 }, items: [
    { id: "r1", author: "Aïcha M.", rating: 5, comment: "Très bon riz, livré chaud et rapide.", reply: "Merci Aïcha, à bientôt !", created_at: iso(3000), is_mine: false },
    { id: "r2", author: "Ibrahim S.", rating: 3, comment: "Bon mais un peu long.", reply: null, created_at: iso(9000), is_mine: false },
  ] }],
  [/\/seller\/profile$/, { id: "sp1", vendor_id: "v1", business_name: "Chez Awa", activity_type: "restaurant", storefront_tier: "basic", offers_restaurant: true, city: "Niamey" }],
  [/\/categories$/, { items: [] }],
  [/\/restaurant\/seller\/menu$/, menu],
  [/\/seller\/stats$/, { is_premium: false, this_week: { views: 84, contacts: 19, orders: 7 }, last_week: { views: 61, contacts: 21, orders: 5 }, days: Array.from({ length: 7 }, (_, i) => ({ day: new Date(now - (6 - i) * 86400000).toISOString().slice(0, 10), views: [5, 9, 14, 8, 17, 12, 19][i], contacts: 2 })) }],
  [/\/restaurant\/seller\/orders$/, orders],
  [/\/restaurant\/seller\/settings$/, { weekly_hours: null, orders_paused: false, is_open: true, open_label: "Ouvert" }],
  [/\/seller\/subscription-status$/, { has_seller_profile: true, onboarding_fee_paid: true, subscription_active: true, monthly_fee: 1000, onboarding_fee: 0, amount_due_now: 0, currency: "XOF", has_pending_payment_request: false, subscription_paid_until: iso(-9000) }],
];

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message.slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") console.log("console:", m.text().slice(0, 400)); });
await page.setRequestInterception(true);
page.on("request", (request) => {
  const url = request.url().split("?")[0];
  const hit = url.includes("/api/v1/") ? mocks.find(([pattern]) => pattern.test(url)) : null;
  if (hit) return request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(hit[1]) });
  if (url.includes("/api/v1/")) return request.respond({ status: 200, contentType: "application/json", body: "[]" });
  return request.continue();
});
await page.setCookie({ name: "access_token", value: "fake", url: base });
await page.goto(base, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.evaluate(() => localStorage.setItem("amazer_access_token", "fake"));
await page.setViewport({ width: 390, height: 2200 });
const shots = [
  ["client-menu", "/shop/v1", "Ajouter Riz sauce arachide"],
  ["resto-commandes", "/seller/dashboard#commandes", null],
  ["resto-menu", "/seller/dashboard#produits", "Modifier Riz sauce arachide"],
  ["resto-reglages", "/seller/dashboard#reglages", null],
  ["resto-accueil", "/seller/dashboard#accueil", null],
];
for (const [name, path, click] of shots) {
  await page.goto("about:blank");
  await page.goto(`${base}${path}`, { waitUntil: "networkidle2", timeout: 180000 });
  await new Promise((r) => setTimeout(r, 5000));
  if (click) await page.evaluate((label) => document.querySelector(`button[aria-label='${label}']`)?.click(), click);
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: name === "client-menu" });
  console.log(name, "overflow", await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
}
await browser.close();
