// Apercu de la page admin Affilies avec des donnees simulees (aucun appel reel au serveur).
import puppeteer from "puppeteer";

const out = process.argv[2];
const base = "http://localhost:3100";
const now = new Date().toISOString();
const row = (id, name, extra) => ({ user_id: id, full_name: name, contact: `${id}@example.test`, whatsapp_phone: "+22790000001", code: "K7M4QA",
  tier: "affiliate", status: "active", clicks: 120, referred: 9, flagged_referrals: 0, earned: 12000, pending: 250, on_hold: 3000, review: 0,
  available: 9000, requested: 0, paid: 0, orders_delivered: 4, ambassador_applied_at: null, ambassador_application: null, admin_note: null, ...extra });
const affiliates = [
  row("a1", "Fatima Issa", { tier: "ambassador", review: 1500, flagged_referrals: 3 }),
  row("a2", "Moussa Ali", { ambassador_applied_at: now, ambassador_application: "Je connais les commerçants du marché Katako." }),
];
const payouts = [{ id: "p1", user_id: "a1", full_name: "Fatima Issa", tier: "ambassador", amount: 9000, method: "nita", phone: "+22790000001",
  status: "requested", transaction_reference: null, admin_note: null, review_amount: 1500, created_at: now, processed_at: null }];
const ledger = [
  { id: "l1", kind: "seller_subscription", amount: 2500, status: "review", percent: 50, note: "plusieurs inscriptions depuis la même connexion", source_name: "Boutique Zara", reference: "seller-sub:1", created_at: now, available_at: now },
  { id: "l2", kind: "customer_bonus", amount: 250, status: "available", percent: null, note: null, source_name: "Awa", reference: "order-bonus:1", created_at: now, available_at: now },
];
const mocks = [
  [/\/auth\/me$/, { id: "admin", email: "admin@example.test", full_name: "Admin", whatsapp_phone: null, is_active: true, role: "admin", created_at: now }],
  [/\/admin\/me$/,{ is_admin: true, email: "admin@example.test", role: "admin" }],
  [/affiliate-earnings$/, affiliates],
  [/affiliate-payouts$/, payouts],
  [/\/ledger$/, ledger],
];
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message.slice(0, 300)));
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
await page.goto(base, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.setItem("amazer_access_token", "fake"));
await page.setViewport({ width: 390, height: 2400 });
await page.goto(`${base}/admin/affilies`, { waitUntil: "networkidle2", timeout: 180000 });
await page.waitForFunction(() => document.body.innerText.includes("Paiements à faire"), { timeout: 120000 });
await new Promise((r) => setTimeout(r, 2000));
await page.screenshot({ path: `${out}/admin-payouts.png` });
const clickText = async (text) => page.evaluate((t) => [...document.querySelectorAll("button")].find((b) => b.textContent.includes(t))?.click(), text);
await clickText("Affiliés (");
await new Promise((r) => setTimeout(r, 1000));
await clickText("Détail des gains");
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: `${out}/admin-affiliates.png` });
console.log("overflow", await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
await browser.close();
