// Apercu transport (client, embarquement, billet) avec des donnees simulees (aucun appel reel au serveur).
import puppeteer from "puppeteer";

const out = process.argv[2];
const base = "http://localhost:3100";
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
const trips = [
  { id: "nm", name: "Niamey → Maradi", description: null, night_price: 12000, capacity: 50, room_count: 1, amenities: ["Climatisé", "Bagages inclus"], photo_urls: [], deposit_amount: null, departure_times: ["06:00", "14:00"], available_days: [day(1), day(2), day(4)] },
  { id: "nz", name: "Niamey → Zinder", description: null, night_price: 18000, capacity: 50, room_count: 1, amenities: ["Climatisé"], photo_urls: [], deposit_amount: null, departure_times: ["05:30"], available_days: [] },
];
const storefront = {
  vendor_id: "t1", vendor_slug: "rimbo", business_name: "Sahel Voyages", activity_type: "transport", storefront_tier: "premium", city: "Niamey",
  address: "Gare routière", phone: "+22790000005", description: "Cars climatisés", logo_url: null, cover_image_url: null, opening_hours: null,
  whatsapp_contact: null, contact_email: null, gallery_images: [], service_offerings: [], room_types: trips, deposit_payment_method: "nita",
  deposit_amount: null, payout_phone: "+22790000005", effective_commission_rate: 0, effective_service_fee: 0, accepts_table_reservations: false,
  accepts_hotel_bookings: true, offers_transport: true, offers_shop: false, offers_restaurant: false, is_verified: true, products: [], restaurant_menu: [],
};
const b = (id, status, offset, time, name, seats) => ({
  id, vendor_id: "t1", room_type_id: "nm", room_snapshot: { name: "Niamey → Maradi" }, guest_name: name, guest_phone: "+22790000006", guest_email: null,
  check_in_date: day(offset), check_out_date: day(offset + 1), guest_count: seats, deposit_payment_method: "nita", deposit_amount: 12000 * seats,
  payment_status: status === "pending" ? "pending" : "paid", transaction_reference: "NT55", special_request: null, status, created_at: new Date().toISOString(), departure_time: time,
});
const bookings = [b("p1", "confirmed", 1, "06:00", "Hadiza Ali", 2), b("p2", "pending", 1, "06:00", "Saidou Amadou", 1), b("p3", "checked_in", 1, "06:00", "Fati Moussa", 1), b("p4", "confirmed", 2, "14:00", "Issa Garba", 3)];
const mine = [{ id: "p1", kind: "transport", vendor_id: "t1", place_name: "Sahel Voyages", item_name: "Niamey → Maradi", check_in_date: day(1), check_out_date: day(2), departure_time: "06:00", guest_count: 2, amount: 24000, status: "confirmed", payment_status: "paid", ticket_token: "p1.0123456789abcdef0123456789abcdef", created_at: new Date().toISOString() }];
const mocks = [
  [/\/auth\/me$/, { id: "u1", email: "client@example.test", full_name: "Hadiza Ali", whatsapp_phone: null, is_active: true, role: "user", created_at: day(-100) }],
  [/\/seller\/storefront\/t1$/, storefront],
  [/\/seller\/storefront\/t1\/seats$/, { trip_id: "nm", day: day(1), seats_left: { "06:00": 3, "14:00": 47 } }],
  [/\/seller\/profile$/, { id: "sp1", vendor_id: "t1", business_name: "Sahel Voyages", activity_type: "transport", storefront_tier: "premium", accepts_hotel_bookings: true, offers_transport: true, offers_shop: false, room_types: trips, city: "Niamey" }],
  [/\/seller\/hotel-bookings$/, bookings],
  [/\/seller\/my-bookings$/, mine],
  [/\/orders\/me$/, []],
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
const click = (text) => page.evaluate((t) => [...document.querySelectorAll("button")].find((x) => x.textContent.includes(t))?.click(), text);
for (const [name, path] of [["transport-client", "/shop/t1"], ["transport-desk", "/seller/dashboard#commandes"], ["transport-billet", "/dashboard"]]) {
  await page.goto("about:blank");
  await page.goto(`${base}${path}`, { waitUntil: "networkidle2", timeout: 180000 });
  await new Promise((r) => setTimeout(r, 5000));
  if (name === "transport-client") {
    await page.waitForSelector("#trips-title", { timeout: 60000 });
    await new Promise((r) => setTimeout(r, 3000));
    await click("Niamey → Maradi");
    await new Promise((r) => setTimeout(r, 1500));
    console.log("jours:", await page.evaluate(() => [...document.querySelectorAll("button")].filter((x) => x.className.includes("rounded-pill border px-4")).map((x) => x.textContent).join(",")));
    await page.waitForFunction(() => [...document.querySelectorAll("button")].some((x) => x.className.includes("first-letter:uppercase")), { timeout: 30000 });
    await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.className.includes("first-letter:uppercase"))?.click());
    await new Promise((r) => setTimeout(r, 2000));
    await new Promise((r) => setTimeout(r, 4000));
    console.log("apres jour:", (await page.evaluate(() => document.querySelector("#trips-title")?.closest("section")?.innerText || "")).slice(0, 400).replaceAll(String.fromCharCode(10), " | "));
    await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.startsWith("06:00"))?.click());
    await new Promise((r) => setTimeout(r, 800));
  }
  if (name === "transport-billet") {
    await page.waitForFunction(() => document.body.innerText.includes("Afficher mon billet"), { timeout: 60000 });
    await click("Afficher mon billet");
    await new Promise((r) => setTimeout(r, 800));
  }
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: name === "transport-client" });
  console.log(name, "overflow", await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
}
await browser.close();
