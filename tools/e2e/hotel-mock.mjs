// Apercu hotel (client + reception) avec des donnees simulees (aucun appel reel au serveur).
import puppeteer from "puppeteer";

const out = process.argv[2];
const base = "http://localhost:3100";
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
const rooms = [
  { id: "std", name: "Chambre Standard", description: "Lit double, salle de bain privée, climatisation.", night_price: 25000, capacity: 2, room_count: 6, amenities: ["Climatisée", "Wi-Fi", "TV"], photo_urls: [], deposit_amount: null },
  { id: "suite", name: "Suite Fleuve", description: "Vue sur le fleuve Niger, salon séparé.", night_price: 60000, capacity: 4, room_count: 1, amenities: ["Petit-déjeuner", "Balcon"], photo_urls: [], deposit_amount: null },
];
const storefront = {
  vendor_id: "h1", vendor_slug: "hotel-gaweye", business_name: "Hôtel du Fleuve", activity_type: "hotel", storefront_tier: "premium", city: "Niamey",
  address: "Corniche", phone: "+22790000003", description: "Hôtel 4 étoiles au bord du fleuve", logo_url: null, cover_image_url: null, opening_hours: null,
  whatsapp_contact: null, contact_email: null, gallery_images: [], service_offerings: [], room_types: rooms, deposit_payment_method: "nita",
  deposit_amount: null, payout_phone: "+22790000003", effective_commission_rate: 0, effective_service_fee: 0, accepts_table_reservations: false,
  accepts_hotel_bookings: true, offers_transport: false, offers_shop: false, offers_restaurant: false, is_verified: true, products: [], restaurant_menu: [],
};
const booking = (id, status, start, nights, name) => ({
  id, vendor_id: "h1", room_type_id: "std", room_snapshot: { name: "Chambre Standard" }, guest_name: name, guest_phone: "+22790000004", guest_email: null,
  check_in_date: day(start), check_out_date: day(start + nights), guest_count: 2, deposit_payment_method: "nita", deposit_amount: 25000 * nights,
  payment_status: status === "pending" ? "pending" : "paid", transaction_reference: "NT123", special_request: status === "pending" ? "Arrivée vers 22 h" : null, status, created_at: new Date().toISOString(),
});
const bookings = [booking("b1", "pending", 2, 3, "Aïcha Mahamadou"), booking("b2", "confirmed", 0, 2, "Ibrahim Souley"), booking("b3", "checked_in", -1, 3, "Mariam Issa"), booking("b4", "confirmed", 5, 1, "Oumarou Kané")];
const mocks = [
  [/\/auth\/me$/, { id: "u1", email: "hotel@example.test", full_name: "Hôtel", whatsapp_phone: null, is_active: true, role: "user", created_at: day(-100) }],
  [/\/seller\/storefront\/h1$/, storefront],
  [/\/seller\/storefront\/h1\/availability$/, { check_in_date: day(0), check_out_date: day(1), nights: 1, available: { std: 2, suite: 0 } }],
  [/\/seller\/profile$/, { id: "sp1", vendor_id: "h1", business_name: "Hôtel du Fleuve", activity_type: "hotel", storefront_tier: "premium", accepts_hotel_bookings: true, offers_transport: false, room_types: rooms, city: "Niamey" }],
  [/\/seller\/hotel-bookings$/, bookings],
  [/\/categories/, { items: [] }],
];
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message.slice(0, 200)));
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
await page.setViewport({ width: 390, height: 2400 });
for (const [name, path] of [["hotel-client", "/shop/h1"], ["hotel-accueil", "/seller/dashboard#accueil"], ["hotel-reception", "/seller/dashboard#commandes"]]) {
  await page.goto("about:blank");
  await page.goto(`${base}${path}`, { waitUntil: "networkidle2", timeout: 180000 });
  await new Promise((r) => setTimeout(r, 5000));
  if (name === "hotel-client") {
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Choisir")?.click());
    await new Promise((r) => setTimeout(r, 1000));
  }
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: name === "hotel-client" });
  console.log(name, "overflow", await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
}
await browser.close();
