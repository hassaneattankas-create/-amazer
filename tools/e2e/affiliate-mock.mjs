// Apercu de la page Affiliation (ambassadeur) avec des donnees simulees (aucun appel reel au serveur).
import puppeteer from "puppeteer";

const out = process.argv[2];
const base = "http://localhost:3100";
const now = new Date().toISOString();
const me = {
  code: "K7M4QA", tier: "ambassador", status: "active", seller_share_percent: 20, seller_share_months: 12, customer_bonus: 250,
  hold_days: 30, min_payout: 2000, clicks: 184, referred_sellers: 7, referred_customers: 23,
  earnings: { earned: 31750, pending: 750, in_progress: 750, on_hold: 6500, review: 1000, available: 14250, requested: 0, paid: 10000,
    from_sellers: 26000, from_customers: 3750, from_bonus: 2000, orders_delivered: 15, orders_pending: 3 },
  ambassador: { first_month_percent: 50, current_percent: 20, paying_shops: 7, next_tier_shops: 10, next_tier_percent: 25, monthly_top_bonus: 10000 },
  ambassador_applied: false, payout_method: "nita", payout_phone: "+22790000001",
  recent_earnings: [
    { id: "e1", label: "Abonnement d'un vendeur parrainé", amount: 2500, status: "pending", note: null, created_at: now, available_at: new Date(Date.now() + 20 * 86400000).toISOString() },
    { id: "e2", label: "Nouveau client (1re commande livrée)", amount: 250, status: "available", note: null, created_at: now, available_at: now },
    { id: "e3", label: "Nouveau client (1re commande livrée)", amount: 250, status: "cancelled", note: "commande annulée", created_at: now, available_at: now },
  ],
  payouts: [{ id: "p1", amount: 10000, method: "nita", phone: "+22790000001", status: "paid", transaction_reference: "NT2610010042", admin_note: null, created_at: now, processed_at: now }],
};
const board = { month: "2026-10", top_bonus: 10000, rows: [
  { rank: 1, name: "Fatima I.", new_shops: 5, is_me: false }, { rank: 2, name: "Awa M.", new_shops: 3, is_me: true }, { rank: 3, name: "Ali", new_shops: 1, is_me: false },
] };
const mocks = [
  [/\/auth\/me$/, { id: "u1", email: "awa@example.test", full_name: "Awa Moussa", whatsapp_phone: "+22790000001", is_active: true, role: "user", created_at: now }],
  [/\/affiliates\/me$/, me],
  [/\/affiliates\/leaderboard$/, board],
];

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message.slice(0, 300)));
const headers = [];
await page.setRequestInterception(true);
page.on("request", (request) => {
  const url = request.url();
  if (url.includes("/affiliates/")) headers.push(request.headers()["x-device-id"] || "absent");
  const hit = url.includes("/api/v1/") ? mocks.find(([pattern]) => pattern.test(url.split("?")[0])) : null;
  if (hit) return request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(hit[1]) });
  if (url.includes("/api/v1/")) return request.respond({ status: 200, contentType: "application/json", body: "[]" });
  return request.continue();
});
await page.setCookie({ name: "access_token", value: "fake", url: base });
await page.goto(base, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.setItem("amazer_access_token", "fake"));
for (const [w, h] of [[390, 3000], [1280, 2400]]) {
  await page.setViewport({ width: w, height: h });
  await page.goto(`${base}/affiliation`, { waitUntil: "networkidle2", timeout: 180000 });
  await new Promise((r) => setTimeout(r, 4000));
  await page.screenshot({ path: `${out}/affiliation-${w}.png` });
  console.log(w, "overflow", await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
}
console.log("x-device-id envoye :", headers.slice(0, 2));
await browser.close();
