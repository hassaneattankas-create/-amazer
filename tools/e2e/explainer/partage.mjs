// Supports de partage tirés des guides « pas à pas » (sans site ni navigateur filmé) :
//   6. Images étape par étape (une image par étape, texte compris, prête pour WhatsApp)
//   7. Affiche récapitulative (une image : les 6 étapes clés)
//   8. Vidéo courte (< 1 min, pour les statuts)
// Prérequis : avoir tourné les guides pas à pas (explainer/.work/<type>-images/NN.jpg).
// Usage (depuis tools/e2e) : PARTAGE_OUT="…/AMAZER - Guides et videos" node explainer/partage.mjs [type…]
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { createRequire } from "module";

import { assemble } from "./lib.mjs";
import { GUIDES } from "./pas-a-pas.mjs";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer");

const OUT = process.env.PARTAGE_OUT || "C:/Users/User/Desktop/AMAZER - Guides et videos";
const DIR_IMG = `${OUT}/6. Images etape par etape`;
const DIR_AFF = `${OUT}/7. Affiches recapitulatives`;
const DIR_VID = `${OUT}/8. Videos courtes (statuts)`;
const WORK = path.resolve("explainer/.work/partage");
const NAMES = { client: "Client", boutique: "Boutique", restaurant: "Restaurant", hotel: "Hotel", transport: "Transport", pharmacie: "Pharmacie", station: "Station-essence", revendeur: "Revendeur", affilie: "Affilie", livreur: "Livreur" };

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const untitled = (s) => String(s ?? "").replace(/^\d+\.\s*/, "");
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
const plain = (s) => String(s ?? "").replace(/\*\*/g, "").replace(/\s*→\s*/g, ", puis ").replace(/XOF/g, "francs CFA");
const uri = (file) => `data:image/${file.endsWith(".png") ? "png" : "jpeg"};base64,${fs.readFileSync(file).toString("base64")}`;
const seconds = (file) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());
const LOGO = uri(path.resolve("../../frontend/public/logo-amazer-mark.png"));

const CSS = `
  :root { --o:#E84800; --os:#FFF1EA; --ink:#0F172A; --sub:#475569; --line:#E2E8F0; }
  * { box-sizing:border-box; }
  body { margin:0; width:1080px; height:1920px; overflow:hidden; font-family:"Segoe UI", system-ui, sans-serif; color:var(--ink); background:#F8FAFC; }
  .top { background:var(--ink); color:#fff; padding:44px 60px 40px; display:flex; align-items:center; gap:22px; }
  .top img { width:76px; height:76px; }
  .brand { font-weight:800; letter-spacing:.16em; color:#FF8A57; font-size:26px; }
  .gt { font-size:40px; font-weight:800; line-height:1.1; margin-top:4px; }
  b { color:var(--o); }`;

/** Une étape : capture du vrai écran + son explication. */
const stepHtml = (g, s, n, total) => `<style>${CSS}
  .bar { display:flex; justify-content:space-between; align-items:center; padding:34px 60px 0; }
  .num { background:var(--o); color:#fff; font-weight:800; font-size:34px; border-radius:99px; padding:10px 30px; }
  .ch { color:var(--sub); font-size:30px; font-weight:600; max-width:600px; text-align:right; }
  body { display:flex; flex-direction:column; }
  .shot { flex:1; min-height:0; display:flex; justify-content:center; align-items:center; padding:30px 0 0; }
  .shot img { max-height:100%; border-radius:36px; box-shadow:0 20px 60px rgba(15,23,42,.22); border:6px solid #fff; }
  .txt { margin:34px 60px 50px; background:#fff; border-radius:30px; padding:34px 40px; box-shadow:0 6px 24px rgba(15,23,42,.08); }
  h3 { font-size:48px; margin:0 0 12px; line-height:1.15; }
  p { font-size:36px; line-height:1.4; margin:0; color:#1E293B; }
  .tip { margin-top:16px; font-size:30px; color:var(--sub); }
</style>
<div class="top"><img src="${LOGO}"><div><div class="brand">AMAZER</div><div class="gt">${esc(g.title)}</div></div></div>
<div class="bar"><span class="num">Étape ${n} / ${total}</span><span class="ch">${esc(s.chapter)}</span></div>
<div class="shot"><img src="${uri(s.img)}"></div>
<div class="txt"><h3>${rich(s.title)}</h3><p>${rich(s.text)}</p>${s.tip ? `<div class="tip">💡 ${rich(s.tip)}</div>` : ""}</div>`;

/** L'affiche : les étapes clés sur une seule image. */
const posterHtml = (g, keys, video) => `<style>${CSS}
  .top { padding:56px 60px 50px; }
  .sub { color:#CBD5E1; font-size:30px; margin-top:8px; }
  .grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:26px 24px; padding:40px 44px 0; }
  .t { background:#fff; border-radius:26px; padding:16px 16px 20px; box-shadow:0 6px 22px rgba(15,23,42,.08); }
  .t .im { position:relative; }
  .t img { width:100%; aspect-ratio:9/16; object-fit:cover; object-position:top; border-radius:16px; display:block; border:1px solid var(--line); }
  .n { position:absolute; top:-6px; left:-6px; width:58px; height:58px; border-radius:50%; background:var(--o); color:#fff; font-weight:800; font-size:30px; display:flex; align-items:center; justify-content:center; border:4px solid #fff; }
  .t h4 { font-size:27px; margin:14px 0 4px; line-height:1.2; }
  .t p { font-size:21px; line-height:1.35; margin:0; color:var(--sub); }
  .foot { position:absolute; bottom:0; left:0; right:0; background:var(--o); color:#fff; padding:30px 60px; font-size:30px; display:flex; justify-content:space-between; align-items:center; }
  .foot strong { font-size:38px; }
</style>
<div class="top"><img src="${LOGO}"><div><div class="brand">AMAZER · ${esc(g.who)}</div><div class="gt">${esc(g.title)}</div><div class="sub">${esc(g.subtitle)}</div></div></div>
<div class="grid">${keys.map((s, i) => `<div class="t"><div class="im"><img src="${uri(s.img)}"><span class="n">${i + 1}</span></div><h4>${rich(untitled(s.title))}</h4><p>${rich(s.text)}</p></div>`).join("")}</div>
<div class="foot"><strong>amazer.store</strong><span>Vidéo complète : ${esc(video)}</span></div>`;

/** Carte de début / fin de la vidéo courte. */
const cardHtml = (big, small) => `<style>${CSS}
  body { background:var(--ink); color:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }
  img { width:170px; height:170px; margin-bottom:40px; }
  .brand { font-size:40px; }
  h1 { font-size:86px; line-height:1.1; margin:24px 70px 20px; }
  p { font-size:40px; color:#FFB08A; margin:0 70px; }
</style><img src="${LOGO}"><div class="brand">AMAZER</div><h1>${esc(big)}</h1><p>${esc(small)}</p>`;

/** 6 étapes clés : au moins une par chapitre, le reste réparti sur les plus longs. */
function keySteps(chapters, slots = 6) {
  const want = chapters.map(() => 1);
  const cap = (i) => (i === 0 ? 2 : chapters[i].length);
  for (let left = slots - want.length; left > 0; left -= 1) {
    let best = -1;
    chapters.forEach((c, i) => { if (want[i] < cap(i) && (best < 0 || c.length / (want[i] + 1) > chapters[best].length / (want[best] + 1))) best = i; });
    if (best < 0) break;
    want[best] += 1;
  }
  return chapters.flatMap((c, i) => Array.from({ length: Math.min(want[i], c.length) }, (_, k) => c[Math.floor((k * c.length) / want[i])]));
}

function voice(text, file) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      execFileSync("python", ["-m", "edge_tts", "--voice", "fr-FR-HenriNeural", "--rate=+8%", "--text", text, "--write-media", file], { stdio: "pipe" });
      return seconds(file);
    } catch (err) {
      if (attempt >= 5) throw new Error(`Voix impossible : ${String(err.stderr).slice(-200)}`);
      execFileSync("powershell", ["-NoProfile", "-Command", `Start-Sleep -Seconds ${3 * attempt}`]);
    }
  }
}

/** Une diapositive : image fixe, fondu, voix (et un léger silence après). */
function slide(img, mp3, out) {
  const d = seconds(mp3) + 0.7;
  execFileSync("ffmpeg", ["-y", "-loop", "1", "-framerate", "30", "-i", img, "-i", mp3,
    "-vf", `scale=720:1280:flags=lanczos,fade=t=in:st=0:d=0.25,fade=t=out:st=${(d - 0.25).toFixed(2)}:d=0.25,format=yuv420p`,
    "-af", "apad", "-t", d.toFixed(2), "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-r", "30",
    "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "128k", out], { stdio: "ignore" });
  return d;
}

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
const shoot = async (html, file) => { await page.setContent(html, { waitUntil: "load" }); await page.screenshot({ path: file, type: "jpeg", quality: 86 }); };

const wanted = process.argv.slice(2);
for (const [key, g] of Object.entries(GUIDES)) {
  if (wanted.length && !wanted.includes(key)) continue;
  const imgs = path.resolve(`explainer/.work/${key}-images`);
  let n = 0;
  const chapters = g.chapters.map((c) => c.scenes.filter((s) => s.guide).map((s) => ({ ...s.guide, chapter: c.title, img: path.join(imgs, `${String(++n).padStart(2, "0")}.jpg`) })));
  const steps = chapters.flat();
  if (!steps.every((s) => fs.existsSync(s.img))) { console.log(`${key} : images manquantes, guide à retourner d'abord`); continue; }
  const name = NAMES[key] ?? key;

  // 6. une image par étape
  const dir = `${DIR_IMG}/${name}`;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const [i, s] of steps.entries()) {
    s.card = `${dir}/Etape-${String(i + 1).padStart(2, "0")}.jpg`;
    await shoot(stepHtml(g, s, i + 1, steps.length), s.card);
  }

  // 7. l'affiche
  const keys = keySteps(chapters);
  fs.mkdirSync(DIR_AFF, { recursive: true });
  await shoot(posterHtml(g, keys, g.video), `${DIR_AFF}/AMAZER-Affiche-${name}.jpg`);

  // 8. la vidéo courte : début, étapes clés, fin
  const work = path.join(WORK, key);
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const topic = g.title.replace(/, pas à pas$/, "");
  const plan = [
    { img: path.join(work, "debut.jpg"), html: cardHtml(topic, "L'essentiel en une minute"), say: `${topic} sur AMAZER : l'essentiel en une minute.` },
    ...keys.map((s) => ({ img: s.card, say: plain(s.text) })),
    { img: path.join(work, "fin.jpg"), html: cardHtml(g.end[0], "amazer.store"), say: "Rendez-vous sur amazer point store. La vidéo complète vous montre chaque clic." },
  ];
  const parts = [];
  let total = 0;
  for (const [i, p] of plan.entries()) {
    if (p.html) await shoot(p.html, p.img);
    const mp3 = path.join(work, `v${i}.mp3`);
    voice(p.say, mp3);
    const out = path.join(work, `p${i}.mp4`);
    total += slide(p.img, mp3, out);
    parts.push(out);
  }
  fs.mkdirSync(DIR_VID, { recursive: true });
  assemble(parts, `${DIR_VID}/AMAZER_court-${key}.mp4`);
  console.log(`${key} : ${steps.length} images, affiche (${keys.length} étapes), vidéo ${total.toFixed(0)} s${total > 60 ? "  ⚠ plus d'une minute" : ""}`);
}
await browser.close();
