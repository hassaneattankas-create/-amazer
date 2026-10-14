/**
 * Parcours de bout en bout AMAZER — lecture seule.
 *
 * Verifie, dans un vrai navigateur, que les parcours publics fonctionnent :
 * accueil, boutiques, page boutique (bouton de contact), centre d'aide,
 * mot de passe oublie, protection des pages privees, API.
 * Aucun compte n'est cree, aucune commande n'est passee : sans risque en production.
 *
 *   node smoke.mjs                       # https://amazer.store
 *   SITE_URL=http://localhost:3000 API_URL=http://localhost:8000 node smoke.mjs
 */
import puppeteer from "puppeteer";

const SITE = (process.env.SITE_URL || "https://amazer.store").replace(/\/$/, "");
const API = (process.env.API_URL || "https://amazer-api.onrender.com").replace(/\/$/, "");
const TIMEOUT = 90_000;

const results = [];
async function check(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
  } catch (error) {
    results.push({ name, ok: false, ms: Date.now() - started, error: String(error?.message || error).slice(0, 200) });
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function getJson(path) {
  const response = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(TIMEOUT) });
  return { status: response.status, body: response.ok ? await response.json() : null };
}

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true }); // mobile d'abord
page.setDefaultTimeout(TIMEOUT);
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error.message || error)));

async function visit(path) {
  const response = await page.goto(`${SITE}${path}`, { waitUntil: "networkidle2", timeout: TIMEOUT });
  return response;
}
async function bodyText() {
  return page.evaluate(() => document.body.innerText);
}

let firstShopId = null;

await check("API /health repond", async () => {
  const { status } = await getJson("/health");
  assert(status === 200, `statut ${status}`);
});

await check("API liste des boutiques", async () => {
  const { status, body } = await getJson("/api/v1/storefronts?limit=5");
  assert(status === 200, `statut ${status}`);
  assert(Array.isArray(body?.items), "format inattendu");
  firstShopId = body.items[0]?.id ?? null;
});

await check("API : les donnees privees exigent une connexion", async () => {
  for (const path of ["/api/v1/orders/me", "/api/v1/conversations", "/api/v1/admin/moderation/reports"]) {
    const { status } = await getJson(path);
    assert(status === 401, `${path} -> ${status} (401 attendu)`);
  }
});

await check("Accueil s'affiche", async () => {
  const response = await visit("/");
  assert(response?.status() === 200, `statut ${response?.status()}`);
  assert((await page.title()).length > 0, "titre vide");
});

await check("Page Boutiques liste des commerces", async () => {
  await visit("/boutiques");
  const text = await bodyText();
  assert(/Boutiques/i.test(text), "titre Boutiques absent");
});

await check("Page boutique : bouton « Écrire à la boutique »", async () => {
  assert(firstShopId, "aucune boutique publique");
  await visit(`/shop/${firstShopId}`);
  const link = await page.waitForSelector('a[href^="/messages?vendor="]', { timeout: TIMEOUT });
  assert(link, "bouton de contact absent");
});

await check("Centre d'aide « Comment ça marche ? »", async () => {
  await visit("/comment-ca-marche");
  const text = await bodyText();
  assert(text.includes("Comment ça marche ?"), "titre absent");
  assert(text.includes("Acheter sur AMAZER") && text.includes("Vendre sur AMAZER"), "rubriques absentes");
});

await check("Mot de passe oublie : formulaire present", async () => {
  await visit("/forgot-password");
  assert(await page.$("#identifier"), "champ identifiant absent");
});

await check("Messages : redirection vers la connexion si deconnecte", async () => {
  await visit("/messages");
  assert(page.url().includes("/login"), `URL ${page.url()}`);
});

await check("Pied de page : bouton WhatsApp vers AMAZER", async () => {
  await visit("/comment-ca-marche");
  // Le numero est charge apres l'affichage : on attend le lien.
  const link = await page.waitForSelector('footer a[href^="https://wa.me/"]', { timeout: 30_000 }).catch(() => null);
  const href = link ? await link.evaluate((node) => node.getAttribute("href")) : null;
  assert(href && /^https:\/\/wa\.me\/\d{10,15}/.test(href), `lien WhatsApp absent ou invalide : ${href}`);
});

await check("Espace livreur : reserve aux personnes connectees", async () => {
  await visit("/livreur");
  assert(page.url().includes("/login"), `URL ${page.url()}`);
  const { status } = await getJson("/api/v1/courier/orders/available");
  assert(status === 401, `API livreur sans connexion -> ${status} (401 attendu)`);
});

await check("Aucune erreur JavaScript sur les pages visitees", async () => {
  assert(pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
});

await browser.close();

const failed = results.filter((result) => !result.ok);
for (const result of results) {
  console.log(`${result.ok ? "OK   " : "ECHEC"} ${result.name} (${result.ms} ms)${result.ok ? "" : ` — ${result.error}`}`);
}
console.log(`\n${results.length - failed.length}/${results.length} parcours valides sur ${SITE}`);
process.exit(failed.length ? 1 : 0);
