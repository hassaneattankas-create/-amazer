// Verifs urgentes (telephone 390 px) : menu deroulant visible, message d'erreur en haut a l'ajout de produit.
import puppeteer from "puppeteer";

const out = process.argv[2];
const base = "http://localhost:3100";
const now = new Date().toISOString();
const mocks = [
  [/\/auth\/me$/, { id: "u1", email: "vendeur@example.test", full_name: "Irkoy Gomno", whatsapp_phone: null, is_active: true, role: "user", created_at: now }],
  [/\/seller\/profile$/, { id: "sp1", vendor_id: "v1", business_name: "Ets IRKOY GOMNO", activity_type: "shop", storefront_tier: "basic", offers_shop: true, city: "Niamey" }],
  [/\/categories$/, { items: [] }],
  [/\/seller\/subscription-status$/, { has_seller_profile: true, onboarding_fee_paid: true, subscription_active: true, monthly_fee: 1000, onboarding_fee: 0, amount_due_now: 0, currency: "XOF", has_pending_payment_request: false, subscription_paid_until: now }],
];
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message.slice(0, 200)));
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });

// 1) menu sur l'accueil (vrai site local, pas de simulation)
await page.goto(base, { waitUntil: "networkidle2", timeout: 180000 });
await page.waitForSelector("button[aria-label='Menu']", { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));
await page.click("button[aria-label='Menu']");
await new Promise((r) => setTimeout(r, 600));
const box = await page.evaluate(() => {
  const r = document.querySelector("#main-menu")?.getBoundingClientRect();
  return r ? { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), vw: innerWidth } : null;
});
console.log("menu:", JSON.stringify(box));
await page.screenshot({ path: `${out}/menu-mobile.png` });

// 2) ajout de produit vide -> message en haut
await page.setRequestInterception(true);
page.on("request", (request) => {
  const url = request.url().split("?")[0];
  const hit = url.includes("/api/v1/") ? mocks.find(([p]) => p.test(url)) : null;
  if (hit) return request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(hit[1]) });
  if (url.includes("/api/v1/")) return request.respond({ status: 200, contentType: "application/json", body: "[]" });
  return request.continue();
});
await page.setCookie({ name: "access_token", value: "fake", url: base });
await page.evaluate(() => localStorage.setItem("amazer_access_token", "fake"));
await page.goto(`${base}/seller/dashboard#ajouter`, { waitUntil: "networkidle2", timeout: 180000 });
await new Promise((r) => setTimeout(r, 4000));
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Ajouter au catalogue"))?.click());
await new Promise((r) => setTimeout(r, 800));
console.log("message:", await page.evaluate(() => document.querySelector("[role=alert]")?.textContent ?? "aucun"));
await page.screenshot({ path: `${out}/ajout-produit.png` });
await browser.close();
