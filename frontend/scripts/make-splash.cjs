/* make-splash.cjs — écran d'ouverture AMAZER (Android + page web d'ouverture).
 * Fond orange en dégradé, motif discret d'icônes au trait (Lucide, licence ISC) qui racontent AMAZER,
 * logo dans son carré blanc et nom AMAZER au centre.
 *   node scripts/make-splash.cjs          -> android/app/src/main/res/drawable*\/splash.png + public/splash/motif.svg
 * Puppeteer : celui de tools/e2e (aucune dépendance ajoutée au site).
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const puppeteer = require(path.resolve(__dirname, "../../tools/e2e/node_modules/puppeteer"));

const ROOT = path.resolve(__dirname, "..");
const ICONS = ["shopping-cart", "shopping-bag", "pill", "fuel", "utensils", "bike", "smartphone", "bed-double", "bus", "shirt", "store", "package", "gift", "coffee", "truck", "headphones", "watch", "sandwich"];

// tracés des icônes (fichiers ESM de lucide-react : tableaux [balise, attributs])
const icon = (name) => {
  const src = fs.readFileSync(path.join(ROOT, "node_modules/lucide-react/dist/esm/icons", `${name}.js`), "utf8");
  const nodes = [...src.matchAll(/\[\s*"(\w+)",\s*\{([^}]*)\}\s*\]/g)].map(([, tag, attrs]) => {
    const a = [...attrs.matchAll(/(\w+):\s*"([^"]*)"/g)].filter(([, k]) => k !== "key").map(([, k, v]) => `${k}="${v}"`).join(" ");
    return `<${tag} ${a}/>`;
  });
  return nodes.join("");
};

/** motif : grille décalée d'icônes au trait, tuile de 6 × 7 icônes */
function motif() {
  const step = 165, cols = 6, rows = 7;
  let out = "";
  let k = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const name = ICONS[(r * 5 + c * 7 + ((r * c) % 3)) % ICONS.length];
      k++;
      const x = c * step + (r % 2 ? step / 2 : 0) + 30, y = r * step + 30;
      const rot = ((k * 37) % 21) - 10;
      out += `<g transform="translate(${x} ${y}) rotate(${rot} 24 24) scale(2.5)" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${icon(name)}</g>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * step}" height="${rows * step}" viewBox="0 0 ${cols * step} ${rows * step}">${out}</svg>`;
}

const MARK = `<svg viewBox="96 100 320 310" xmlns="http://www.w3.org/2000/svg"><path d="M128 390L245 122H275L389 390H332L308 331H206L183 390H128Z" fill="#FF4D00"/><path d="M252 208L286 286H218L252 208Z" fill="#fff"/></svg>`;

(async () => {
  const pattern = motif();
  fs.mkdirSync(path.join(ROOT, "public/splash"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "public/splash/motif.svg"), pattern);
  const font = path.resolve(ROOT, "../motion/amazer-pro/assets/fonts/GeistVF.woff");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:Geist;src:url(${pathToFileURL(font).href}) format('woff');font-weight:100 900}
    html,body{margin:0}
    #s{position:relative;overflow:hidden;background:linear-gradient(165deg,#1E293B 0%,#0F172A 50%,#070B14 100%);font-family:Geist}
    .l{position:absolute;border-radius:50%;filter:blur(10px)}
    #l1{background:radial-gradient(circle,rgba(37,99,235,.28),rgba(37,99,235,0) 62%)}
    #l2{background:radial-gradient(circle,rgba(255,77,0,.32),rgba(255,77,0,0) 62%)}
    #m{position:absolute;inset:0;opacity:.09;-webkit-mask-image:radial-gradient(circle at 50% 50%,transparent 0 22%,black 46%);background-image:url("data:image/svg+xml;utf8,${encodeURIComponent(pattern)}")}
    #c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
    .ic{border-radius:25%;background:linear-gradient(160deg,#fff,#FFF6EF);display:grid;place-items:center;box-shadow:0 3vmin 7vmin -2vmin rgba(120,30,0,.5)}
    .w{color:#fff;font-weight:800;letter-spacing:-.04em;line-height:1}
    .halo{position:absolute;border-radius:50%;background:radial-gradient(circle,rgba(255,77,0,.42),rgba(255,77,0,0) 60%)}
  </style></head><body><div id="s"><div class="l" id="l1"></div><div class="l" id="l2"></div><div id="m"></div><div class="halo" id="h"></div><div id="c"><div class="ic">${MARK}</div><div class="w">AMAZER</div></div></div></body></html>`;
  const tmp = path.join(ROOT, ".splash-tmp.html");
  fs.writeFileSync(tmp, html);
  const browser = await puppeteer.launch({ headless: true, args: ["--allow-file-access-from-files"] });
  const page = await browser.newPage();
  await page.goto(pathToFileURL(tmp).href);
  await page.evaluate(() => document.fonts.ready);
  const RES = path.join(ROOT, "android/app/src/main/res");
  for (const d of fs.readdirSync(RES).filter((x) => x.startsWith("drawable"))) {
    const f = path.join(RES, d, "splash.png");
    if (!fs.existsSync(f)) continue;
    const buf = fs.readFileSync(f);
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20); // en-tête PNG
    const m = Math.min(w, h);
    await page.setViewport({ width: w, height: h });
    await page.evaluate((w, h, m) => {
      const s = document.getElementById("s");
      s.style.width = w + "px"; s.style.height = h + "px";
      document.getElementById("m").style.backgroundSize = `${m * 1.1}px auto`;
      const L = Math.max(w, h) * 1.2; const l1 = document.getElementById("l1"), l2 = document.getElementById("l2");
      Object.assign(l1.style, { width: L + "px", height: L + "px", left: -L * .38 + "px", top: -L * .46 + "px" });
      Object.assign(l2.style, { width: L + "px", height: L + "px", left: w - L * .58 + "px", top: h - L * .5 + "px" });
      const ic = s.querySelector(".ic"); ic.style.width = ic.style.height = m * 0.3 + "px";
      ic.querySelector("svg").style.width = m * 0.2 + "px";
      const wd = s.querySelector(".w"); wd.style.fontSize = m * 0.115 + "px"; wd.style.marginTop = m * 0.06 + "px";
      const ha = document.getElementById("h"); ha.style.width = ha.style.height = m * 1.3 + "px"; ha.style.left = (w - m * 1.3) / 2 + "px"; ha.style.top = (h - m * 1.3) / 2 + "px";
    }, w, h, m);
    await page.screenshot({ path: f, clip: { x: 0, y: 0, width: w, height: h } });
    console.log("écran d'ouverture", d, w + "×" + h);
  }
  await browser.close();
  fs.unlinkSync(tmp);
})().catch((e) => { console.error(e); process.exit(1); });
