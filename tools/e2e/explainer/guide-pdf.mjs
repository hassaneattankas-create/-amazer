// Guide PDF illustré : vraies captures (élément à toucher entouré en orange) + texte simple.
// buildGuide(guide, sortie.pdf) — guide = { title, lead, points, chapters:[{ title, intro?, steps:[{ img, title, text }] }], tips, faq, video }
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer");
const LOGO = path.resolve("../../frontend/public/logo-amazer-mark.png");

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// **gras** dans les textes
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

function html(g, dir) {
  let n = 0;
  const img = (file) => pathToFileURL(file).href;
  const logo = fs.existsSync(LOGO) ? `<img class="logo" src="${img(LOGO)}" alt="">` : "";
  const chapters = g.chapters.map((c, ci) => `
    <section class="${ci ? "chap" : "chap first"}">
      <h2><span class="cn">${ci + 1}</span>${esc(c.title)}</h2>
      ${c.intro ? `<p class="intro">${rich(c.intro)}</p>` : ""}
      ${c.steps.map((s) => `
        <div class="step">
          <figure>${s.img ? `<img src="${img(s.img)}" alt="">` : ""}</figure>
          <div class="txt"><div class="num">Étape ${++n}</div><h3>${esc(s.title)}</h3><p>${rich(s.text)}</p>${s.tip ? `<div class="mini">${rich(s.tip)}</div>` : ""}</div>
        </div>`).join("")}
    </section>`).join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(g.title)}</title><style>
  @page { size: A4; margin: 14mm 14mm 16mm; }
  :root { --o:#E84800; --os:#FFF1EA; --ink:#0F172A; --sub:#475569; --line:#E2E8F0; }
  * { box-sizing: border-box; }
  body { margin:0; color:var(--ink); font: 11pt/1.5 "Segoe UI", system-ui, sans-serif; }
  .cover { height: 262mm; display:flex; flex-direction:column; justify-content:space-between; }
  .top { display:flex; align-items:center; gap:10px; }
  .logo { height: 34px; }
  .brand { font-weight:800; letter-spacing:.14em; color:var(--o); font-size:12pt; }
  .who { margin-top: 26mm; display:inline-block; background:var(--os); color:var(--o); font-weight:700; border-radius:99px; padding:4px 14px; font-size:10.5pt; }
  h1 { font-size: 30pt; line-height:1.1; margin: 10px 0 12px; letter-spacing:-.015em; }
  .lead { font-size: 13.5pt; color: var(--sub); max-width: 160mm; }
  .points { display:grid; grid-template-columns: repeat(3,1fr); gap:10px; margin-top: 14mm; }
  .pt { border:1px solid var(--line); border-radius:14px; padding:13px; }
  .pt b { display:block; font-size:12pt; margin-bottom:4px; }
  .pt i { font-style:normal; display:inline-flex; width:28px; height:28px; border-radius:50%; background:var(--o); color:#fff; font-weight:800; align-items:center; justify-content:center; margin-bottom:8px; }
  .howto { border-radius:14px; background:#0F172A; color:#fff; padding:14px 16px; font-size:10.5pt; }
  .howto b { color:#FFB08A; }
  .chap { break-before: page; }
  h2 { font-size: 18pt; margin: 0 0 6px; display:flex; align-items:center; gap:10px; }
  .cn { display:inline-flex; width:34px; height:34px; border-radius:10px; background:var(--o); color:#fff; align-items:center; justify-content:center; font-size:14pt; }
  .intro { color: var(--sub); margin: 0 0 8px; }
  .step { display:grid; grid-template-columns: 54mm 1fr; gap: 14px; align-items:center; padding: 9px 0; border-bottom: 1px solid var(--line); break-inside: avoid; }
  .step:last-child { border-bottom: 0; }
  figure { margin:0; width:54mm; border-radius: 14px; overflow:hidden; border: 1px solid var(--line); box-shadow: 0 3px 10px rgba(15,23,42,.08); }
  figure img { width:100%; display:block; }
  .num { color: var(--o); font-weight: 800; font-size: 9.5pt; letter-spacing:.08em; text-transform: uppercase; }
  h3 { font-size: 14pt; margin: 2px 0 6px; line-height:1.25; }
  .txt p { margin:0; font-size: 11.5pt; }
  .mini { margin-top: 8px; background: var(--os); border-radius: 10px; padding: 7px 10px; font-size: 10pt; }
  .end { break-before: page; }
  .box { border-radius: 14px; padding: 12px 15px; margin: 10px 0; break-inside: avoid; }
  .tips { background: var(--os); border-left: 5px solid var(--o); }
  .tips li { margin: 5px 0; }
  .faq h3 { color: var(--o); font-size: 12pt; margin: 12px 0 3px; }
  .faq p { margin: 0; }
  .video { background:#F1F5F9; }
  .foot { margin-top: 14px; color: var(--sub); font-size: 9.5pt; border-top: 1px solid var(--line); padding-top: 8px; }
  </style></head><body>
  <section class="cover">
    <div>
      <div class="top">${logo}<span class="brand">AMAZER</span></div>
      <span class="who">${esc(g.who)}</span>
      <h1>${esc(g.title)}</h1>
      <p class="lead">${rich(g.lead)}</p>
      <div class="points">${g.points.map((p, i) => `<div class="pt"><i>${i + 1}</i><b>${esc(p[0])}</b>${rich(p[1])}</div>`).join("")}</div>
    </div>
    <div class="howto"><b>Comment lire ce guide :</b> chaque étape montre le vrai écran d'AMAZER sur téléphone. L'endroit à toucher est <b>entouré en orange</b>, avec la flèche de la souris dessus. Les noms et chiffres des exemples sont fictifs.</div>
  </section>
  ${chapters}
  <section class="end">
    <h2><span class="cn">✓</span>Pour bien réussir</h2>
    <div class="box tips"><ul>${g.tips.map((t) => `<li>${rich(t)}</li>`).join("")}</ul></div>
    ${g.faq?.length ? `<div class="faq"><h2 style="font-size:15pt;margin-top:16px">Questions fréquentes</h2>${g.faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${rich(a)}</p>`).join("")}</div>` : ""}
    ${g.video ? `<div class="box video"><b>La vidéo de ce guide :</b> ${esc(g.video)}</div>` : ""}
    <p class="foot">Une question ? Ouvrez <b>amazer.store</b>, menu <b>Comment ça marche</b>, ou écrivez au service client depuis votre compte.</p>
  </section>
  </body></html>`;
}

export async function buildGuide(g, outPdf) {
  const dir = path.dirname(outPdf);
  fs.mkdirSync(dir, { recursive: true });
  const htmlFile = path.resolve("explainer/.work", `${path.basename(outPdf, ".pdf")}.html`);
  fs.writeFileSync(htmlFile, html(g, dir));
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlFile).href, { waitUntil: "networkidle0" });
  await page.pdf({
    path: outPdf, format: "A4", printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="width:100%;font-size:8px;color:#64748B;text-align:center;font-family:Segoe UI,sans-serif">AMAZER · ${esc(g.title)} · page <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
  });
  // aperçu des premières pages pour vérification
  await page.setViewport({ width: 794, height: 1123 });
  await page.screenshot({ path: path.resolve("explainer/.work", `${path.basename(outPdf, ".pdf")}-apercu.png`), fullPage: true });
  await browser.close();
  console.log(`${outPdf} : ${(fs.statSync(outPdf).size / 1048576).toFixed(1)} Mo`);
}
