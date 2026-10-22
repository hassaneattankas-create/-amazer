// Contrôle visuel de toutes les pages publiques en production : capture mobile + ordinateur,
// erreurs JavaScript, débordement horizontal et textes suspects (sans accents fréquents).
import fs from "node:fs";
import puppeteer from "puppeteer";

const base = process.argv[2] || "https://amazer.store";
const out = process.argv[3] || "./allpages-out";
fs.mkdirSync(out, { recursive: true });

const pages = [
  "/", "/?q=riz", "/boutiques", "/promotions", "/restaurant", "/hotels", "/pharmacies", "/stations",
  "/product/c44e3e70-f575-4cb8-bade-bce590c93ee6", "/shop/8c2d9430-7cc1-46e9-a6b1-97ca1cffb1ba",
  "/category/alimentation", "/cart", "/vendre", "/revendre", "/affiliation", "/formations", "/avis",
  "/comment-ca-marche", "/legal/terms", "/legal/privacy", "/legal/account-deletion",
  "/login", "/register", "/register?next=/seller&seller=1&type=shop", "/forgot-password",
  "/dashboard", "/messages", "/notifications", "/livreur", "/seller", "/admin", "/order/pay/inexistant",
];
const suspect = /\b(deja|ete|recu|numero|telephone|reference|securise|annulee|payee|Reessayez|reessayez)\b/;

const browser = await puppeteer.launch({ headless: true });
const report = [];
for (const path of pages) {
  for (const width of [390, 1280]) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
    await page.setViewport({ width, height: width === 390 ? 844 : 900 });
    let status = 0;
    try {
      const res = await page.goto(`${base}${path}`, { waitUntil: "networkidle2", timeout: 90000 });
      status = res?.status() ?? 0;
    } catch (e) {
      errors.push(`navigation: ${e.message.slice(0, 80)}`);
    }
    await new Promise((r) => setTimeout(r, 2500));
    const info = await page.evaluate((re) => {
      const text = document.body?.innerText ?? "";
      const words = text.match(new RegExp(re, "g")) ?? [];
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        url: location.pathname + location.search,
        h1: document.querySelector("h1")?.textContent?.trim().slice(0, 60) ?? "",
        suspect: [...new Set(words)].slice(0, 5),
      };
    }, suspect.source);
    const name = `${path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}-${width}`;
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: width === 390 });
    report.push({ path, width, status, ...info, errors });
    console.log(
      `${status} ${width}px ${path} -> ${info.url} | h1="${info.h1}" | overflow=${info.overflow}` +
        (info.suspect.length ? ` | mots: ${info.suspect.join(",")}` : "") +
        (errors.length ? ` | ERREURS: ${errors.join(" ; ")}` : "")
    );
    await page.close();
  }
}
await browser.close();
fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
