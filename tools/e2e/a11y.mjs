/**
 * Audit d'accessibilite automatique (axe-core, regles WCAG 2.2 A/AA) des pages publiques.
 * Lecture seule. axe trouve environ la moitie des problemes : le reste demande une verification a la main.
 *
 *   node a11y.mjs                         # http://localhost:3100
 *   SITE_URL=https://amazer.store node a11y.mjs
 *   node a11y.mjs /stations /pharmacies   # pages choisies
 */
import { createRequire } from "node:module";
import puppeteer from "puppeteer";

const require = createRequire(import.meta.url);
// Moteur axe-core injecte directement (l'adaptateur @axe-core/puppeteer ne suit pas Puppeteer 25).
const AXE_PATH = require.resolve("axe-core/axe.min.js");
const SITE = (process.env.SITE_URL || "http://localhost:3100").replace(/\/$/, "");
const PAGES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["/", "/stations", "/pharmacies", "/vendre", "/affiliation", "/login", "/register", "/promotions", "/boutiques", "/comment-ca-marche", "/hotels"];
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const browser = await puppeteer.launch({ headless: true });
let total = 0;
let failed = 0;
for (const path of PAGES) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  try {
    await page.goto(`${SITE}${path}`, { waitUntil: "networkidle2", timeout: 120_000 });
    await new Promise((r) => setTimeout(r, 2500));
    await page.addScriptTag({ path: AXE_PATH });
    const violations = await page.evaluate(async (tags) => {
      // Hors site : l'outil de developpement de Next.js.
      const result = await window.axe.run({ exclude: [["nextjs-portal"]] }, { runOnly: { type: "tag", values: tags } });
      return result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.map((n) => ({ target: n.target.join(" "), summary: n.failureSummary || "" })),
      }));
    }, TAGS);
    const issues = violations.filter((v) => v.impact === "serious" || v.impact === "critical" || v.impact === "moderate");
    total += issues.length;
    console.log(`\n${issues.length ? "A CORRIGER" : "OK"}  ${path}  (${issues.length} regle(s))`);
    for (const v of issues) {
      console.log(`  [${v.impact}] ${v.id} : ${v.help} (${v.nodes.length} element(s))`);
      for (const node of v.nodes.slice(0, 3)) console.log(`      ${node.target}  ${node.summary.split("\n")[1]?.trim() ?? ""}`);
    }
  } catch (error) {
    failed += 1;
    console.log(`\nERREUR  ${path} : ${error.message}`);
  } finally {
    await page.close();
  }
}
await browser.close();
console.log(`\n${total} regle(s) a corriger au total${failed ? `, ${failed} page(s) non auditee(s)` : ""}.`);
process.exit(failed ? 2 : 0);
