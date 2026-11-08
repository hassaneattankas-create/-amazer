// Fabrique de vidéos explicatives : vraies pages du site, souris visible, sous-titres et voix off française.
// Chaque scène : phrase dite + actions. La voix est générée d'abord, l'image est enregistrée en direct,
// puis la voix est posée exactement au moment où chaque scène a commencé.
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer");

export const BASE = process.env.EXPLAINER_BASE || "http://localhost:3100";
const API = "https://amazer-api.onrender.com";
/** Écran de téléphone filmé : 360 × 640 points, rendu 1080 × 1920 pixels. */
const VW = 360;
const VH = 640;
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const VOICE = "fr-FR-HenriNeural";
const SAY = [[/AMAZER/g, "Amazaire"], [/amazer\.store/gi, "amazaire point store"]];
const spoken = (text) => SAY.reduce((t, [a, b]) => t.replace(a, b), text);
const seconds = (file) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());

/** Calque ajouté à la page filmée : souris, sous-titre, titre de chapitre. */
const OVERLAY = () => {
  if (document.getElementById("xp-root")) return;
  const style = document.createElement("style");
  style.textContent = `
    #xp-root{position:fixed;inset:0;z-index:2147483646;pointer-events:none;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
    #xp-cursor{position:absolute;left:0;top:0;width:30px;height:30px;transition:transform .75s cubic-bezier(.22,1,.36,1);filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}
    #xp-ring{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #FF4D00;opacity:0}
    #xp-ring.on{animation:xp .6s ease-out}
    @keyframes xp{0%{opacity:1;transform:scale(.3)}100%{opacity:0;transform:scale(1.7)}}
    #xp-caption{position:absolute;left:12px;right:12px;bottom:18px;background:rgba(15,23,42,.92);color:#fff;border-radius:14px;padding:11px 13px;font-size:15.5px;line-height:1.32;font-weight:600;text-align:center;opacity:0;transition:opacity .2s}
    #xp-caption.on{opacity:1}
    #xp-title{position:absolute;inset:0;background:#0F172A;color:#fff;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:28px;gap:14px}
    #xp-title.on{display:flex}
    #xp-title.on ~ #xp-cursor{display:none}
    #xp-title b{font-size:34px;line-height:1.15;letter-spacing:-.01em}
    #xp-title span{font-size:18px;line-height:1.35;color:#FFB08A}
    #xp-title i{font-style:normal;font-weight:800;font-size:22px;letter-spacing:.08em;color:#FF4D00}
    #xp-tick{position:absolute;left:0;top:0;width:2px;height:2px;background:rgba(255,255,255,.01);animation:xp-t .1s steps(2) infinite alternate}
    @keyframes xp-t{to{background:rgba(255,255,255,.03);left:1px}}
    .xp-hide{display:none!important}
    .xp-spot{outline:4px solid #FF4D00!important;outline-offset:3px!important;box-shadow:0 0 0 9px rgba(255,77,0,.22)!important;border-radius:10px}`;
  document.head.append(style);
  const root = document.createElement("div");
  root.id = "xp-root";
  root.innerHTML = `<div id="xp-tick"></div><div id="xp-ring"></div><div id="xp-caption"></div><div id="xp-title"></div>
    <svg id="xp-cursor" viewBox="0 0 24 24"><path d="M4 2l15 12-7 1 4 7-3 2-4-7-5 5z" fill="#fff" stroke="#0F172A" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  document.body.append(root);
  // barre d'installation et bulle d'aide : hors sujet à l'image
  for (const e of document.querySelectorAll("body *")) {
    if (e.closest("#xp-root")) continue;
    const c = getComputedStyle(e);
    if (c.position === "fixed" && e.getBoundingClientRect().top > innerHeight * 0.55) e.classList.add("xp-hide");
  }
};

export class Film {
  constructor(name, { mocks, user, onWrite, proxy, forward } = {}) {
    this.name = name;
    this.dir = path.resolve("explainer/.work", name);
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
    this.mocks = mocks || [];
    this.user = user;
    this.onWrite = onWrite;
    this.proxy = !!proxy;
    this.forward = forward;
    this.cues = [];
    this.snaps = [];
    this.focus = [];
    this.captions = [];
    this.pos = { x: 180, y: 300 };
  }

  async open() {
    this.browser = await puppeteer.launch({ headless: true, args: ["--force-device-scale-factor=3", "--hide-scrollbars", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: VW, height: VH, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await this.page.setRequestInterception(true);
    this.page.on("pageerror", (e) => console.log("erreur page :", e.message.slice(0, 160)));
    const cors = { "Access-Control-Allow-Origin": BASE, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" };
    const json = (request, status, body) => request.respond({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    this.page.on("request", async (request) => {
      const full = request.url();
      const url = full.split("?")[0];
      if (url.includes("/api/admin-proxy/")) return json(request, 403, {});
      if (!url.includes("/api/v1/")) return request.continue();
      if (request.method() === "OPTIONS") {
        // Avec identifiants, « * » ne vaut rien : on renvoie exactement ce que le navigateur demande.
        const h = request.headers();
        return request.respond({ status: 204, headers: { ...cors, "Access-Control-Allow-Headers": h["access-control-request-headers"] || "content-type", "Access-Control-Allow-Methods": h["access-control-request-method"] || "GET" } });
      }
      const hit = this.mocks.find(([pattern]) => pattern.test(url));
      if (hit && request.method() === "GET") return json(request, 200, typeof hit[1] === "function" ? hit[1](url) : hit[1]);
      // Calculs publics sans effet (ex. devis du panier) : on demande au vrai serveur.
      if (request.method() === "POST" && this.forward?.test(url)) {
        try {
          const r = await fetch(`${API}/api/v1/${full.split("/api/v1/")[1]}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: request.postData() || "{}" });
          return request.respond({ status: r.status, contentType: "application/json", headers: cors, body: await r.text() });
        } catch {
          return json(request, 502, {});
        }
      }
      if (request.method() !== "GET") return json(request, 200, this.onWrite ? (this.onWrite(url, JSON.parse(request.postData() || "{}"), request.method()) ?? {}) : {});
      if (this.mocks.length && !this.proxy) return json(request, 200, []);
      // Pages publiques : vraies données, en lecture seule.
      try {
        const r = await fetch(`${API}/api/v1/${full.split("/api/v1/")[1]}`);
        // Écran connecté non simulé : réponse vide plutôt qu'une déconnexion.
        if (r.status === 401 || r.status === 403) return json(request, 200, []);
        return request.respond({ status: r.status, contentType: "application/json", headers: cors, body: await r.text() });
      } catch {
        return json(request, 502, {});
      }
    });
    if (this.user) {
      await this.page.setCookie({ name: "access_token", value: "demo", url: BASE });
      await this.page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await this.page.evaluate(() => {
        localStorage.setItem("amazer_access_token", "demo");
        localStorage.setItem("amazer_refresh_token", "demo");
        localStorage.setItem("amazer_install_dismissed_until", String(Date.now() + 86400000));
      });
    }
  }

  async goto(route) {
    await this.page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
    // Le site interroge le serveur en continu : on attend un court calme réseau, pas un silence total.
    await this.page.waitForNetworkIdle({ idleTime: 700, timeout: 20000, concurrency: 2 }).catch(() => {});
    await wait(1800);
    await this.page.evaluate(OVERLAY);
    await this.place();
  }

  place() {
    const { x, y } = this.pos;
    return this.page.evaluate((x, y) => { document.getElementById("xp-cursor").style.transform = `translate(${x}px,${y}px)`; }, x, y);
  }

  title(big, small) {
    return this.page.evaluate((big, small) => {
      const t = document.getElementById("xp-title");
      t.innerHTML = big ? `<i>AMAZER</i><b>${big}</b>${small ? `<span>${small}</span>` : ""}` : "";
      t.classList.toggle("on", !!big);
    }, big, small);
  }

  /** Change de personnage de démonstration (données simulées). */
  useMocks(mocks) {
    this.mocks = mocks;
  }

  /** Trouve un élément visible par son texte, le centre à l'écran et y amène la souris. */
  async point(text, { selector = "button,a,[role=radio],[role=button],input,select,textarea,label,h1,h2,h3,summary", nth = 0 } = {}) {
    const box = await this.page.evaluate((text, selector, nth) => {
      const norm = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
      const want = norm(text);
      const label = (e) => norm(e.matches("input,textarea,select") ? e.placeholder || e.getAttribute("aria-label") || e.labels?.[0]?.innerText || e.value : e.innerText || e.getAttribute("aria-label"));
      const all = [...document.querySelectorAll(selector)].filter((e) => e.offsetParent !== null && !e.closest("#xp-root") && e.getBoundingClientRect().width > 8);
      const hits = all.filter((e) => label(e) === want).concat(all.filter((e) => label(e).startsWith(want)), all.filter((e) => label(e).includes(want)));
      document.querySelectorAll("[data-xp]").forEach((e) => e.removeAttribute("data-xp"));
      // Le titre d'une catégorie est à l'intérieur de son bouton : on vise le bouton.
      const target = (e) => e.closest("button,a,[role=radio]") || e.querySelector?.("button") || e;
      const unique = [...new Set(hits.map(target))].filter((e) => e.offsetParent !== null);
      const el = unique[nth] || unique[0];
      if (!el) return null;
      el.setAttribute("data-xp", "1");
      document.querySelectorAll("[data-xp-last]").forEach((e) => e.removeAttribute("data-xp-last"));
      el.setAttribute("data-xp-last", "1");
      const r = el.getBoundingClientRect();
      window.scrollTo({ top: Math.max(0, r.top + scrollY - innerHeight * 0.4), behavior: "smooth" });
      return true;
    }, text, selector, nth);
    if (!box) { console.log(`  élément introuvable : ${text}`); return false; }
    await wait(650);
    const r = await this.page.evaluate(() => { const b = document.querySelector("[data-xp]").getBoundingClientRect(); return { x: b.left + Math.min(b.width * .5, 150), y: b.top + b.height * .55 }; });
    this.pos = { x: Math.round(r.x), y: Math.round(r.y) };
    if (this.start) this.focus.push({ t: (Date.now() - this.start) / 1000, x: this.pos.x / VW, y: this.pos.y / VH, z: 1.22 });
    await this.place();
    await wait(850);
    return true;
  }

  /** Montre l'endroit, marque le clic, puis clique vraiment. */
  async click(text, opts) {
    if (!(await this.point(text, opts))) return false;
    if (this.focus.length) this.focus[this.focus.length - 1].z = 1.38;
    await this.page.evaluate(({ x, y }) => {
      const ring = document.getElementById("xp-ring");
      ring.style.left = `${x + 5}px`; ring.style.top = `${y + 5}px`;
      ring.classList.remove("on"); void ring.offsetWidth; ring.classList.add("on");
    }, this.pos);
    await wait(260);
    // Pour le guide PDF : l'image montre le bouton avant qu'on le touche.
    if (this.pending && !this.typing) { const t = this.pending; this.pending = null; await this.snap(t); }
    await this.page.evaluate(() => {
      const e = document.querySelector("[data-xp]");
      e.removeAttribute("data-xp");
      // Une catégorie déjà ouverte reste ouverte.
      if (e.getAttribute("aria-expanded") !== "true") e.click();
      if (e.matches("input,textarea")) e.focus();
    });
    await wait(900);
    // Le clic a pu ouvrir une autre page : on remet la souris et le calque.
    await this.page.waitForNetworkIdle({ idleTime: 500, timeout: 8000, concurrency: 2 }).catch(() => {});
    await this.page.evaluate(() => document.querySelectorAll("[data-xp]").forEach((e) => e.removeAttribute("data-xp"))).catch(() => {});
    await this.page.evaluate(OVERLAY).catch(() => {});
    await this.place().catch(() => {});
    return true;
  }

  /** Écrit lettre par lettre dans le champ désigné. */
  async type(field, value, opts) {
    this.typing = true;
    const ok = await this.click(field, { selector: "input,textarea", ...opts });
    this.typing = false;
    if (!ok) return;
    await this.page.keyboard.type(value, { delay: 45 });
    await wait(300);
  }

  scroll(y) {
    return this.page.evaluate((y) => window.scrollBy({ top: y, behavior: "smooth" }), y).then(() => wait(900));
  }

  /** Génère la voix de chaque scène avant de filmer : sa durée règle le rythme. */
  async voices(scenes) {
    for (const [i, s] of scenes.entries()) {
      s.file = path.join(this.dir, `s${i}.mp3`);
      for (let attempt = 1; ; attempt += 1) {
        try {
          execFileSync("python", ["-m", "edge_tts", "--voice", VOICE, "--rate=+4%", "--text", spoken(s.say), "--write-media", s.file], { stdio: "pipe" });
          break;
        } catch (err) {
          if (attempt >= 5) throw new Error(`Voix impossible : ${String(err.stderr).slice(-200)}`);
          await wait(3000 * attempt);
        }
      }
      s.duration = seconds(s.file);
    }
  }

  /**
   * Enregistreur image par image (protocole Chrome) : chaque image est accusée tout de suite
   * et gardée avec son heure exacte. Plus de retard ni de défilement oublié.
   */
  async record() {
    const dir = path.join(this.dir, "images");
    fs.mkdirSync(dir, { recursive: true });
    const frames = [];
    const writes = [];
    const cdp = await this.page.createCDPSession();
    let running = true;
    // Trois captures en vol à la fois : environ 16 images par seconde en 1080 × 1920.
    const worker = async () => {
      while (running) {
        const sent = Date.now();
        const shot = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 86, optimizeForSpeed: true }).catch(() => null);
        if (!shot || !running) continue;
        const file = path.join(dir, `${sent}-${frames.length}.jpg`);
        frames.push({ file, at: (sent + Date.now()) / 2 });
        writes.push(fs.promises.writeFile(file, Buffer.from(shot.data, "base64")));
      }
    };
    const workers = [worker(), worker(), worker()];
    const list = path.join(this.dir, "images.txt");
    return {
      list,
      stop: async () => {
        running = false;
        await Promise.all(workers);
        await Promise.all(writes);
        await cdp.detach().catch(() => {});
        if (!frames.length) throw new Error("Aucune image enregistrée");
        frames.sort((x, y) => x.at - y.at);
        const start = this.start ?? frames[0].at;
        const end = Date.now();
        const lines = ["ffconcat version 1.0"];
        frames.forEach((f, i) => {
          const from = i === 0 ? start : f.at;
          const next = i + 1 < frames.length ? frames[i + 1].at : end;
          lines.push(`file '${f.file.replaceAll("\\", "/")}'`, `duration ${Math.max(0.001, (next - from) / 1000).toFixed(3)}`);
        });
        lines.push(`file '${frames.at(-1).file.replaceAll("\\", "/")}'`);
        fs.writeFileSync(list, lines.join(String.fromCharCode(10)));
        console.log(`  ${frames.length} images en ${((end - start) / 1000).toFixed(1)} s`);
      },
    };
  }

  /** Image pour le guide PDF : l'élément visé est entouré, la souris reste visible. */
  async snap(text) {
    const file = path.join(this.dir, `g${this.snaps.length}.jpg`);
    await this.page.evaluate(() => document.querySelector("[data-xp-last]")?.classList.add("xp-spot"));
    await this.page.screenshot({ path: file, type: "jpeg", quality: 84 });
    await this.page.evaluate(() => document.querySelectorAll(".xp-spot").forEach((e) => e.classList.remove("xp-spot")));
    this.snaps.push({ file, text });
  }

  async play(scenes) {
    await this.voices(scenes);
    await this.open();
    await scenes[0].before?.(this);
    const rec = await this.record();
    const raw = rec.list;
    this.start = Date.now();
    for (const scene of scenes) {
      if (scene.before && scene !== scenes[0]) await scene.before(this);
      const t0 = Date.now();
      const at = (t0 - this.start) / 1000;
      this.cues.push({ file: scene.file, at });
      if (scene.caption !== false) this.captions.push({ text: scene.say, at, end: at + scene.duration + 0.35 });
      await Promise.all([(async () => { this.pending = scene.guide || null; await scene.do?.(this); if (this.pending) { const t = this.pending; this.pending = null; await this.snap(t); } })(), wait(scene.duration * 1000 + 450)]);
      const over = Date.now() - t0 - scene.duration * 1000;
      if (over > 2500) console.log(`  scène longue de ${(over / 1000).toFixed(1)} s : ${scene.say.slice(0, 50)}`);
    }
    await wait(500);
    await rec.stop();
    this.length = (Date.now() - this.start) / 1000;
    await this.renderCaptions();
    await this.browser.close();
    return raw;
  }

  /** Sous-titres dessinés à part en haute définition : ils restent nets pendant les zooms. */
  async renderCaptions() {
    if (!this.captions.length) return;
    const page = await this.browser.newPage();
    await page.setViewport({ width: 1080, height: 700, deviceScaleFactor: 1 });
    for (const [i, c] of this.captions.entries()) {
      c.png = path.join(this.dir, `cap${i}.png`);
      await page.setContent(`<html><body style="margin:0;background:transparent"><div id="c" style="box-sizing:border-box;width:1080px;padding:0 34px 0">
        <div style="font:600 43px/1.3 'Segoe UI',system-ui,sans-serif;color:#fff;background:rgba(15,23,42,.93);border-radius:34px;padding:28px 36px 30px;text-align:center;border-top:6px solid #FF4D00;box-shadow:0 10px 40px rgba(0,0,0,.35)">${c.text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div></div></body></html>`);
      const el = await page.$("#c");
      await el.screenshot({ path: c.png, omitBackground: true });
    }
    await page.close();
  }

  /** Zoom doux vers chaque endroit montré, comme un monteur qui recadre. */
  zoomFilter() {
    const r = 0.45;
    const segs = [];
    this.focus.forEach((f, i) => {
      const next = this.focus[i + 1];
      const a = Math.max(0, f.t - 0.15);
      let b = f.t + (f.z > 1.3 ? 2.3 : 1.8);
      if (next) b = Math.min(b, next.t - 0.15 - r);
      if (b - a < 0.6) return;
      segs.push({ a, b, ...f });
    });
    if (!segs.length) return null;
    const n = (v) => v.toFixed(3);
    const S = (t0) => `(clip((it-${n(t0)})/${r},0,1)*clip((it-${n(t0)})/${r},0,1)*(3-2*clip((it-${n(t0)})/${r},0,1)))`;
    const env = segs.map((s) => `${n(s.z - 1)}*${S(s.a)}*(1-${S(s.b)})`).join("+");
    const on = (s) => `between(it,${n(s.a)},${n(s.b + r)})`;
    const cx = `0.5${segs.map((s) => `+(${n(Math.min(0.85, Math.max(0.15, s.x)) - 0.5)})*${on(s)}`).join("")}`;
    const cy = `0.5${segs.map((s) => `+(${n(Math.min(0.85, Math.max(0.15, s.y)) - 0.5)})*${on(s)}`).join("")}`;
    const z = `1+${env}`;
    return `zoompan=z='${z}':x='clip(iw*(${cx})-iw/zoom/2,0,iw-iw/zoom)':y='clip(ih*(${cy})-ih/zoom/2,0,ih-ih/zoom)':d=1:s=1080x1920:fps=30`;
  }

  /** Assemble l'image, le zoom, les sous-titres et les voix posées à leur moment exact. */
  compose(raw, outFile) {
    const inputs = ["-y", "-f", "concat", "-safe", "0", "-i", raw];
    const filters = [];
    const zoom = this.zoomFilter();
    const D = this.length || 10;
    filters.push(`[0:v]fps=30,scale=2160:3840:flags=bicubic,setsar=1${zoom ? `,${zoom}` : ",scale=1080:1920:flags=lanczos"},format=yuv420p[z0]`);
    let last = "z0";
    let k = 1;
    for (const [i, c] of this.captions.entries()) {
      inputs.push("-i", c.png);
      filters.push(`[${last}][${k}:v]overlay=x=0:y=H-h-70:enable='between(t,${c.at.toFixed(2)},${c.end.toFixed(2)})'[z${i + 1}]`);
      last = `z${i + 1}`;
      k += 1;
    }
    filters.push(`[${last}]fade=t=in:st=0:d=0.3,fade=t=out:st=${(D - 0.35).toFixed(2)}:d=0.35[v]`);
    const first = k;
    this.cues.forEach((c, i) => {
      inputs.push("-i", c.file);
      const ms = Math.round(c.at * 1000);
      filters.push(`[${first + i}:a]adelay=${ms}|${ms}[a${i}]`);
    });
    filters.push(`${this.cues.map((_, i) => `[a${i}]`).join("")}amix=inputs=${this.cues.length}:normalize=0,loudnorm=I=-16:TP=-1.5,apad,atrim=0:${D.toFixed(2)}[a]`);
    fs.writeFileSync(path.join(this.dir, "filtre.txt"), filters.join(";\n"));
    try {
      execFileSync("ffmpeg", [...inputs, "-filter_complex", filters.join(";"), "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-r", "30", "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "160k", "-movflags", "+faststart", outFile], { stdio: ["ignore", "ignore", "pipe"], maxBuffer: 64 * 1024 * 1024 });
    } catch (err) {
      throw new Error(`Montage impossible : ${String(err.stderr).trim().split("\n").slice(-4).join(" | ")}`);
    }
    console.log(`${outFile} : ${seconds(outFile).toFixed(1)} s, ${(fs.statSync(outFile).size / 1048576).toFixed(1)} Mo`);
  }

  async make(scenes, outFile) {
    const raw = await this.play(scenes);
    this.compose(raw, outFile);
    return this.snaps;
  }
}

/** Petite musique d'ambiance libre de droits, fabriquée sur place (une seule fois). */
export function music() {
  const file = path.resolve("explainer/.work/musique.wav");
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    execFileSync("python", [path.resolve("explainer/musique.py"), file], { stdio: "inherit" });
  }
  return file;
}

/** Plusieurs parties tournées séparément, mises bout à bout, puis la musique glissée sous la voix. */
export function assemble(parts, outFile, { withMusic = true } = {}) {
  const list = path.join(path.dirname(parts[0]), `${path.basename(outFile)}.txt`);
  fs.writeFileSync(list, parts.map((p) => `file '${p.replaceAll("\\", "/")}'`).join("\n"));
  const joined = withMusic ? path.join(path.dirname(parts[0]), `joint-${path.basename(outFile)}`) : outFile;
  execFileSync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", joined], { stdio: "ignore" });
  if (withMusic) {
    const graph = "[0:a]asplit=2[voix][cle];[1:a]volume=0.16,afade=t=in:d=1.5[m];[m][cle]sidechaincompress=threshold=0.02:ratio=6:attack=30:release=600[fond];[voix][fond]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[a]";
    const D = seconds(joined);
    execFileSync("ffmpeg", ["-y", "-i", joined, "-stream_loop", "-1", "-i", music(), "-filter_complex", `${graph};[a]afade=t=out:st=${(D - 2).toFixed(2)}:d=2[af]`, "-map", "0:v", "-map", "[af]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-t", D.toFixed(2), "-movflags", "+faststart", outFile], { stdio: "ignore" });
  }
  console.log(`${outFile} : ${seconds(outFile).toFixed(1)} s, ${(fs.statSync(outFile).size / 1048576).toFixed(1)} Mo`);
}
