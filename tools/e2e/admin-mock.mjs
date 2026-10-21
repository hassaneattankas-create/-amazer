// Apercu de l'espace admin (accueil « A traiter », commandes et paiements, livreur) avec des donnees simulees.
import puppeteer from "puppeteer";

const out = process.argv[2];
const base = "http://localhost:3100";
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
const orders = [
  { id: "o1", customer_name: "Awa Moussa", status: "commande", payment_mode: "nita", total_amount: 20500, tracking_code: "AMZ-7K2P", created_at: ago(12), payment_status: "pending", client_reference: "NT-48812239", delivery_district: "Plateau", item_count: 2 },
  { id: "o2", customer_name: "Ibrahim Sani", status: "commande", payment_mode: "amana", total_amount: 9000, tracking_code: "AMZ-9QX1", created_at: ago(30), payment_status: "pending", client_reference: null, delivery_district: "Yantala", item_count: 1 },
  { id: "o3", customer_name: "Fati Issa", status: "preparation", payment_mode: "nita", total_amount: 15000, tracking_code: "AMZ-3HD8", created_at: ago(90), payment_status: "paid", client_reference: null, delivery_district: "Lazaret", item_count: 3 },
];
const courierOrders = [{
  id: "c1", tracking_code: "AMZ-3HD8", status: "preparation", created_at: ago(40), delivery_type: "express_niamey", district: "Lazaret", total_amount: 15000,
  payment_status: "paid", item_count: 3, delivery_fee: 2000, deliver_before: new Date(Date.now() + 50 * 60000).toISOString(),
  pickups: [{ shop_name: "Alimentation Baraka", address: "Grand marché", city: "Niamey", phone: "+22790000001", whatsapp: "+22790000001", opening_hours: "8 h – 21 h",
    maps_url: "https://www.google.com/maps", status: "livraison", status_label: "Prête / remise au livreur", items: ["2 × Riz 5 kg", "1 × Huile 1 L"] }],
  customer_name: "Fati", customer_phone: "+22796000000", delivery_address: null, customer_maps_url: null, assigned_to_me: false, courier_assigned_at: null, delivered_at: null,
}];
const mocks = [
  [/\/auth\/me$/, { id: "a1", email: "admin@example.test", full_name: "Admin", whatsapp_phone: null, is_active: true, role: "admin", created_at: ago(9999) }],
  [/\/admin\/me$/, { is_admin: true, email: "admin@example.test" }],
  [/\/admin\/finance\/orders$/, orders],
  [/\/seller-pre-registrations$/, [{ id: "r1", full_name: "Moussa Garba", identifier: "+22791234567", business_name: "Quincaillerie Garba", activity_type: "shop", storefront_tier: "basic", payment_mode: "nita", months: 1, transaction_reference: "NT-5521", status: "pending", admin_note: null, submitted_at: ago(60) }]],
  [/\/seller-subscription-payments$/, []],
  [/\/affiliate-payouts$/, [{ id: "p1" }]],
  [/\/reseller-payments$/, []],
  [/\/refunds$/, []],
  [/\/admin\/reports$|\/reports$/, []],
  [/\/courier\/orders\/available$/, courierOrders],
  [/\/courier\/orders\/mine$/, []],
  [/\/categories/, { items: [] }],
];
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message.slice(0, 200)));
await page.setRequestInterception(true);
page.on("request", (request) => {
  const url = request.url().split("?")[0];
  const api = url.includes("/api/v1/") || url.includes("/api/admin-proxy/");
  const hit = api ? mocks.find(([pattern]) => pattern.test(url)) : null;
  if (hit) return request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(hit[1]) });
  if (api) return request.respond({ status: 200, contentType: "application/json", body: "[]" });
  return request.continue();
});
await page.setCookie({ name: "access_token", value: "fake", url: base });
await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.evaluate(() => {
  localStorage.setItem("amazer_access_token", "fake");
  const value = JSON.stringify({ token: "fake.pin", exp: Date.now() + 1800000 });
  localStorage.setItem("amazer_admin_finance_verified", value);
  sessionStorage.setItem("amazer_admin_finance_verified", value);
});
await page.setViewport({ width: 1280, height: 1400 });
for (const [name, path, width] of [["admin-home", "/admin", 1280], ["admin-finance", "/admin/finance", 1280], ["livreur", "/livreur", 390]]) {
  await page.setViewport({ width, height: 1600 });
  await page.goto(`${base}${path}`, { waitUntil: "networkidle2", timeout: 180000 });
  await new Promise((r) => setTimeout(r, 6000));
  console.log(name, "debordement:", await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth));
  await page.screenshot({ path: `${out}/${name}.png` });
}
await browser.close();
