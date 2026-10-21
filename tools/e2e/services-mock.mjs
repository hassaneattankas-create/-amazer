// Apercu Pharmacies de garde / Stations-essence avec des donnees simulees (aucun appel reel au serveur).
import puppeteer from "puppeteer";

const out = process.argv[2];
const base = "http://localhost:3100";
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
const item = (o) => ({
  vendor_id: "x", vendor_slug: "x", service_kind: "pharmacy", business_name: "Pharmacie", city: "Niamey", address: null, phone: "+22790000001",
  whatsapp_contact: null, logo_url: null, is_verified: false, latitude: null, longitude: null,
  maps_url: "https://www.google.com/maps/search/?api=1&query=Niamey", delivery_phone: "+22790000099",
  on_duty: false, duty_label: null, fuel: {}, fuel_fresh: false, fuel_updated_at: null, ...o,
});
const pharmacies = {
  items: [
    item({ vendor_id: "ph1", business_name: "Pharmacie du Fleuve", address: "Rond-point Kennedy", is_verified: true, on_duty: true, duty_label: "De garde jusqu'au 27 oct.", latitude: 13.515, longitude: 2.112 }),
    item({ vendor_id: "ph2", business_name: "Pharmacie Yantala", address: "Yantala haut", on_duty: true, duty_label: "De garde", latitude: 13.53, longitude: 2.08 }),
    item({ vendor_id: "ph3", business_name: "Pharmacie Centrale de Maradi", city: "Maradi", address: "Grand marché", delivery_phone: null }),
  ],
  cities: [{ city: "Niamey", count: 2 }, { city: "Maradi", count: 1 }],
  delivery_cities: ["Niamey"],
  fresh_hours: 6,
};
const st = (o) => item({ service_kind: "fuel_station", ...o });
const stations = {
  items: [
    st({ vendor_id: "s1", business_name: "Station Sonidep Plateau", address: "Avenue de la Mairie", is_verified: true, fuel: { super: "available", gasoil: "available", gaz: "out" }, fuel_fresh: true, fuel_updated_at: ago(18) }),
    st({ vendor_id: "s2", business_name: "Station du Rond-point Liberté", address: "Liberté", fuel: { super: "out", gasoil: "available", gaz: "available" }, fuel_fresh: true, fuel_updated_at: ago(65) }),
    st({ vendor_id: "s3", business_name: "Station de Zinder Nord", city: "Zinder", fuel: { super: "available" }, fuel_fresh: false, fuel_updated_at: ago(60 * 9), delivery_phone: null }),
  ],
  cities: [{ city: "Niamey", count: 2 }, { city: "Zinder", count: 1 }],
  delivery_cities: ["Niamey"],
  fresh_hours: 6,
};
const status = {
  service_kind: "pharmacy", on_duty: false, on_duty_now: true, duty_start: day(-1), duty_end: day(5), duty_label: "De garde jusqu'au 27 oct.",
  fuel: {}, fuel_fresh: false, fuel_updated_at: null, latitude: null, longitude: null, maps_url: "https://www.google.com/maps", delivery_phone: "+22790000099",
};
const storefront = {
  vendor_id: "ph1", vendor_slug: "fleuve", business_name: "Pharmacie du Fleuve", activity_type: "enterprise", storefront_tier: "premium", city: "Niamey",
  address: "Rond-point Kennedy", phone: "+22790000001", description: "Pharmacie de quartier, conseils et parapharmacie.", logo_url: null, cover_image_url: null,
  opening_hours: "8 h – 22 h", whatsapp_contact: null, contact_email: null, gallery_images: [], service_offerings: [], room_types: [], deposit_payment_method: null,
  deposit_amount: null, payout_phone: null, effective_commission_rate: 0, effective_service_fee: 0, accepts_table_reservations: false, accepts_hotel_bookings: false,
  offers_transport: false, offers_shop: false, offers_restaurant: false, is_verified: true, products: [], restaurant_menu: [], local_service: pharmacies.items[0],
};
const mocks = [
  [/\/auth\/me$/, { id: "u1", email: "pharma@example.test", full_name: "Awa", whatsapp_phone: null, is_active: true, role: "user", created_at: day(-100) }],
  [/\/services\/pharmacies$/, pharmacies],
  [/\/services\/stations$/, stations],
  [/\/seller\/service-status$/, status],
  [/\/seller\/storefront\/ph1$/, storefront],
  [/\/seller\/profile$/, { id: "sp1", vendor_id: "ph1", business_name: "Pharmacie du Fleuve", activity_type: "enterprise", storefront_tier: "premium", service_kind: "pharmacy", offers_shop: false, room_types: [], city: "Niamey" }],
  [/\/categories/, { items: [] }],
  [/\/affiliates\/me$/, { code: "AW7K2P", tier: "affiliate", status: "active", seller_share_percent: 20, seller_share_months: 12, customer_bonus: 250, hold_days: 30, min_payout: 2000, clicks: 0, referred_sellers: 0, referred_customers: 0, earnings: {}, ambassador: null, ambassador_applied: false, payouts: [] }],
  [/\/orders\/me$/, []],
];
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message.slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("console", m.type() + ":", m.text().slice(0, 220)); });
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
await page.setViewport({ width: 390, height: 1900 });
for (const [name, path] of [["client", "/dashboard"], ["stations", "/stations"]]) {
  await page.goto("about:blank");
  await page.goto(`${base}${path}`, { waitUntil: "networkidle2", timeout: 180000 });
  await new Promise((r) => setTimeout(r, 4000));
  if (name === "pharmacies" || name === "stations") {
    // l'onglet « Toutes » pour voir aussi les cas sans garde / information ancienne
    await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => /Toutes les/.test(x.textContent))?.click());
    await new Promise((r) => setTimeout(r, 1500));
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(name, "debordement horizontal:", overflow);
  await page.screenshot({ path: `${out}/${name}.png` });
}
// menu ouvert
await page.goto(`${base}/pharmacies`, { waitUntil: "networkidle2", timeout: 180000 });
await new Promise((r) => setTimeout(r, 3000));
await page.evaluate(() => document.querySelector('button[aria-label="Menu"]')?.click());
await new Promise((r) => setTimeout(r, 1000));
await page.evaluate(() => [...document.querySelectorAll('#main-menu button')].find((b) => b.textContent.trim().startsWith('Premium'))?.click());
await new Promise((r) => setTimeout(r, 800));
console.log('villes:', await page.evaluate(() => 0));
await page.screenshot({ path: `${out}/menu.png` });
await browser.close();
