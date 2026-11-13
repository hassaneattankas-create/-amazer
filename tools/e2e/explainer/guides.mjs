// Guides AMAZER par type d'utilisateur : une vidéo (souris, zoom, voix, sous-titres, musique) + un PDF illustré.
// Usage : node explainer/guides.mjs [nom…]   (sans nom : tous)   — serveur attendu sur http://localhost:3100.
// Les écrans connectés utilisent des personnages fictifs (personas.mjs) ; rien n'est écrit sur le vrai site.
import fs from "fs";
import path from "path";

import { Film, assemble, wait } from "./lib.mjs";
import { buildGuide } from "./guide-pdf.mjs";
import { GUIDES as GUIDES_ALL } from "./guides-all.mjs";

// GUIDES_SET=pas : guides « pas à pas » (du compte jusqu'au bout, chaque clic) — voir pas-a-pas.mjs.
const GUIDES = process.env.GUIDES_SET === "pas" ? (await import("./pas-a-pas.mjs")).GUIDES : GUIDES_ALL;

const VIDEOS = process.env.EXPLAINER_OUT || "C:/Users/User/Desktop/Videos AMAZER";
const PDFS = process.env.GUIDES_OUT || "C:/Users/User/Desktop/Guides AMAZER";

async function attempt(run) {
  for (let i = 1; ; i += 1) {
    try {
      return await run();
    } catch (err) {
      if (i >= 3) throw err;
      console.log(`  nouvel essai (${String(err.message).slice(0, 80)})`);
      await wait(4000);
    }
  }
}

/** Carte de titre plein écran (début et fin). */
const card = (route, big, small) => async (f) => {
  await f.goto(route);
  await f.title(big, small);
  await wait(300);
};

async function make(name) {
  const g = GUIDES[name];
  console.log(`\n=== ${name} : ${g.title}`);
  const parts = [];
  const chapters = [];
  const film = async (id, persona, scenes) => {
    const out = path.resolve("explainer/.work", `${name}-${id}.mp4`);
    const snaps = await attempt(() => new Film(`${name}-${id}`, typeof persona === "function" ? persona() : persona).make(scenes, out));
    parts.push(out);
    return snaps;
  };
  await film("intro", g.chapters[0].persona, [{ say: g.intro, caption: false, before: card(g.chapters[0].route ?? "/", g.title, g.subtitle) }]);
  for (const [i, c] of g.chapters.entries()) {
    const scenes = c.scenes.map((s, k) => (k === 0 && !s.before ? { ...s, before: (f) => f.goto(c.route) } : s));
    const snaps = await film(`c${i}`, c.persona, scenes);
    chapters.push({ title: c.title, intro: c.intro, steps: snaps.map((s) => ({ img: s.file, ...s.text })) });
  }
  await film("outro", g.chapters[0].persona, [{ say: g.outro, caption: false, before: card(g.chapters[0].route ?? "/", g.end[0], g.end[1]) }]);
  fs.mkdirSync(VIDEOS, { recursive: true });
  const video = `${VIDEOS}/${g.video}`;
  assemble(parts, video);
  // les images du guide sont gardées à côté du PDF
  const imgDir = path.resolve("explainer/.work", `${name}-images`);
  fs.rmSync(imgDir, { recursive: true, force: true });
  fs.mkdirSync(imgDir, { recursive: true });
  let n = 0;
  for (const c of chapters) for (const s of c.steps) { const to = path.join(imgDir, `${String(++n).padStart(2, "0")}.jpg`); fs.copyFileSync(s.img, to); s.img = to; }
  await buildGuide({ ...g, chapters, video: `${g.video} (dossier « ${process.env.GUIDES_SET === "pas" ? "3. Videos pas a pas" : "1. Videos a partager (legeres)"} »).` }, `${PDFS}/${g.pdf}`);
}

const wanted = process.argv.slice(2);
for (const name of Object.keys(GUIDES)) {
  if (!wanted.length || wanted.includes(name)) await make(name);
}

// Le savoir de l'Assistant suit les guides : régénéré après chaque tournage (voir savoir.mjs).
await import("./savoir.mjs").catch((err) => console.log(`Savoir de l'Assistant non régénéré : ${err.message}`));
