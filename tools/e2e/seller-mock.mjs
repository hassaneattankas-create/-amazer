// Apercu de l'espace vendeur avec des donnees simulees (aucun appel reel au serveur).
import puppeteer from "puppeteer";

const out = process.argv[2];
const base = "http://localhost:3100";
const products = Array.from({ length: 30 }, (_, i) => ({
  price_id: `p${i}`, product_id: `prod${i}`, product_name: `Riz parfumé ${i + 1} kg`, brand: "Marque",
  description: "Description courte", main_image_url: null, category_id: null, amount: 5000 + i * 100, currency: "XOF",
  stock_quantity: i % 7 === 0 ? 2 : 40, is_active: i % 5 !== 0, promo_price: null, promo_until: null,
}));
const orders = [
  { id: "o1", tracking_code: "AMZ-1", customer_name: "Awa", status: "commande", payment_status: "paid", total_amount: 12000,
    payment_mode: "nita", created_at: new Date().toISOString(), items: [{ id: "i1", product_id: "prod1", product_name: "Riz parfumé 2 kg", quantity: 1, unit_price: 12000 }] },
];
const mocks = [
  [/\/auth\/me$/, { id: "u1", email: "vendeur@example.test", full_name: "Vendeur Test", whatsapp_phone: null, is_active: true, role: "user", created_at: new Date().toISOString() }],
  [/\/seller\/profile$/, { id: "sp1", vendor_id: "v1", business_name: "Boutique Test", activity_type: "shop", storefront_tier: "basic", offers_shop: true, offers_restaurant: false, city: "Niamey" }],
  [/\/seller\/inventory$/, products],
  [/\/seller\/orders$/, orders],
  [/\/categories/, { items: [] }],
];

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setRequestInterception(true);
page.on("request", (request) => {
  const url = request.url();
  const hit = url.includes("/api/v1/") ? mocks.find(([pattern]) => pattern.test(url.split("?")[0])) : null;
  if (hit) return request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(hit[1]) });
  if (url.includes("/api/v1/")) return request.respond({ status: 200, contentType: "application/json", body: "[]" });
  return request.continue();
});
await page.setCookie({ name: "access_token", value: "fake", url: base });
await page.goto(base, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.setItem("amazer_access_token", "fake"));
await page.setViewport({ width: 390, height: 1100 });
for (const tab of ["commandes"]) {
  await page.goto("about:blank");
  await page.goto(`${base}/seller/dashboard#${tab}`, { waitUntil: "networkidle2", timeout: 180000 });
  await new Promise((r) => setTimeout(r, 8000));
  console.log("url:", await page.evaluate(() => location.href), "| onglet actif:", await page.evaluate(() => document.querySelector("[role=tab][aria-selected=true]")?.textContent));
  await page.screenshot({ path: `${out}/seller-${tab}.png` });
  console.log(tab, "overflow", await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
}
await browser.close();
