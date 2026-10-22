// Apercu : banniere d'installation (iPhone), tuiles de l'accueil, bloc stations de l'admin.
import puppeteer from "puppeteer";

const out = process.argv[2];
const base = "http://localhost:3100";
const browser = await puppeteer.launch({ headless: true });

const home = await browser.newPage();
await home.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1");
await home.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await home.goto(`${base}/`, { waitUntil: "networkidle2", timeout: 180000 });
await new Promise((r) => setTimeout(r, 4000));
console.log("banniere:", await home.evaluate(() => document.querySelector('aside[aria-label="Installer l\'application AMAZER"]')?.innerText ?? "absente"));
console.log("tuiles:", await home.evaluate(() => [...document.querySelectorAll('nav[aria-label="Catégories"] li')].map((li) => li.innerText.trim()).slice(0, 5).join(" | ")));
await home.screenshot({ path: `${out}/home-ios.png` });

const settings = {
  commission_rate: 0.05, service_fee: 200, default_delivery_fee: 1500, urban_delivery_fee: 2000, peripheral_delivery_fee: 2500,
  seller_subscription_fee_shop: 5000, seller_subscription_fee_restaurant: 7000, seller_subscription_fee_premium: 15000,
  max_products_basic_tier: 50, launch_mode_zero_commission: false, platform_wallet_phone: "+22790000000",
  fuel_included_outlets: 3, fuel_tier1_price: 2000, fuel_tier2_price: 1500, fuel_tier3_price: 1000, fuel_network_flat: 50000,
  fuel_base_subscription: 0, fuel_tier1_until: 10, fuel_tier2_until: 30,
};
const admin = await browser.newPage();
await admin.setRequestInterception(true);
admin.on("request", (request) => {
  const url = request.url().split("?")[0];
  const api = url.includes("/api/v1/") || url.includes("/api/admin-proxy/");
  const reply = (body) => request.respond({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  if (/\/auth\/me$/.test(url)) return reply({ id: "a1", email: "admin@example.test", full_name: "Admin", is_active: true, role: "admin", created_at: new Date().toISOString() });
  if (/\/admin\/me$/.test(url)) return reply({ is_admin: true, email: "admin@example.test" });
  if (/\/admin\/finance\/settings$/.test(url)) return reply(settings);
  if (api) return reply([]);
  return request.continue();
});
await admin.setCookie({ name: "access_token", value: "fake", url: base });
await admin.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 180000 });
await admin.evaluate(() => {
  localStorage.setItem("amazer_access_token", "fake");
  const value = JSON.stringify({ token: "fake.pin", exp: Date.now() + 1800000 });
  localStorage.setItem("amazer_admin_finance_verified", value);
  sessionStorage.setItem("amazer_admin_finance_verified", value);
});
await admin.setViewport({ width: 390, height: 900 });
await admin.goto(`${base}/admin/tarifs?vue=reglages`, { waitUntil: "networkidle2", timeout: 180000 });
await new Promise((r) => setTimeout(r, 5000));
const card = await admin.$("#station-pricing-title");
if (card) {
  const section = await card.evaluateHandle((el) => el.closest("section"));
  await section.asElement().screenshot({ path: `${out}/stations-admin.png` });
  console.log("apercu:", await section.evaluate((el) => el.querySelector("ul")?.innerText.replace(/\n/g, " | ")));
} else { console.log("bloc stations absent", await admin.evaluate(() => location.pathname + " | " + document.querySelector("h1")?.textContent)); await admin.screenshot({ path: `${out}/admin-page.png` }); }
console.log("debordement:", await admin.evaluate(() => document.documentElement.scrollWidth - window.innerWidth));
await browser.close();
