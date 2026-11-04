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
    #xp-tick{position:absolute;left:0;top:0;width:1px;height:1px;background:rgba(255,255,255,.01);animation:xp-t .2s linear infinite alternate}
    @keyframes xp-t{to{transform:translateX(1px)}}
    .xp-hide{display:none!important}`;
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
  constructor(name, { mocks, user, onWrite } = {}) {
    this.name = name;
    this.dir = path.resolve("explainer/.work", name);
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
    this.mocks = mocks || [];
    this.user = user;
    this.onWrite = onWrite;
    this.cues = [];
    this.pos = { x: 180, y: 300 };
  }

  async open() {
    this.browser = await puppeteer.launch({ headless: true, args: ["--force-device-scale-factor=1", "--hide-scrollbars"] });
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 390, height: 693, deviceScaleFactor: 2.7692, isMobile: true, hasTouch: true });
    await this.page.setRequestInterception(true);
    this.page.on("pageerror", (e) => console.log("erreur page :", e.message.slice(0, 160)));
    const cors = { "Access-Control-Allow-Origin": BASE, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" };
    const json = (request, status, body) => request.respond({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    this.page.on("request", async (request) => {
      const full = request.url();
      const url = full.split("?")[0];
      if (url.includes("/api/admin-proxy/")) return json(request, 403, {});
      if (!url.includes("/api/v1/")) return request.continue();
      if (request.method() === "OPTIONS") return request.respond({ status: 204, headers: cors });
      const hit = this.mocks.find(([pattern]) => pattern.test(url));
      if (hit && request.method() === "GET") return json(request, 200, typeof hit[1] === "function" ? hit[1](url) : hit[1]);
      if (request.method() !== "GET") return json(request, 200, this.onWrite ? (this.onWrite(url, JSON.parse(request.postData() || "{}"), request.method()) ?? {}) : {});
      if (this.mocks.length) return json(request, 200, []);
      // Pages publiques : vraies données, en lecture seule.
      try {
        const r = await fetch(`${API}/api/v1/${full.split("/api/v1/")[1]}`);
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
    await this.page.goto(`${BASE}${route}`, { waitUntil: "networkidle2", timeout: 120000 }).catch(() => {});
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
      const label = (e) => norm(e.innerText || e.value || e.placeholder || e.getAttribute("aria-label"));
      const all = [...document.querySelectorAll(selector)].filter((e) => e.offsetParent !== null && !e.closest("#xp-root") && e.getBoundingClientRect().width > 8);
      const hits = all.filter((e) => label(e) === want).concat(all.filter((e) => label(e).startsWith(want)), all.filter((e) => label(e).includes(want)));
      document.querySelectorAll("[data-xp]").forEach((e) => e.removeAttribute("data-xp"));
      // Le titre d'une catégorie est à l'intérieur de son bouton : on vise le bouton.
      const target = (e) => e.closest("button,a,[role=radio]") || e.querySelector?.("button") || e;
      const unique = [...new Set(hits.map(target))].filter((e) => e.offsetParent !== null);
      const el = unique[nth] || unique[0];
      if (!el) return null;
      el.setAttribute("data-xp", "1");
      const r = el.getBoundingClientRect();
      window.scrollTo({ top: Math.max(0, r.top + scrollY - innerHeight * 0.4), behavior: "smooth" });
      return true;
    }, text, selector, nth);
    if (!box) { console.log(`  élément introuvable : ${text}`); return false; }
    await wait(650);
    const r = await this.page.evaluate(() => { const b = document.querySelector("[data-xp]").getBoundingClientRect(); return { x: b.left + Math.min(b.width * .5, 150), y: b.top + b.height * .55 }; });
    this.pos = { x: Math.round(r.x), y: Math.round(r.y) };
    await this.place();
    await wait(850);
    return true;
  }

  /** Montre l'endroit, marque le clic, puis clique vraiment. */
  async click(text, opts) {
    if (!(await this.point(text, opts))) return false;
    await this.page.evaluate(({ x, y }) => {
      const ring = document.getElementById("xp-ring");
      ring.style.left = `${x + 5}px`; ring.style.top = `${y + 5}px`;
      ring.classList.remove("on"); void ring.offsetWidth; ring.classList.add("on");
    }, this.pos);
    await wait(260);
    await this.page.evaluate(() => {
      const e = document.querySelector("[data-xp]");
      e.removeAttribute("data-xp");
      // Une catégorie déjà ouverte reste ouverte.
      if (e.getAttribute("aria-expanded") !== "true") e.click();
      if (e.matches("input,textarea")) e.focus();
    });
    await wait(900);
    await this.page.evaluate(() => document.querySelectorAll("[data-xp]").forEach((e) => e.removeAttribute("data-xp")));
    return true;
  }

  /** Écrit lettre par lettre dans le champ désigné. */
  async type(field, value, opts) {
    if (!(await this.click(field, { selector: "input,textarea", ...opts }))) return;
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

  async play(scenes) {
    await this.voices(scenes);
    await this.open();
    await scenes[0].before?.(this);
    const raw = path.join(this.dir, "image.webm");
    const rec = await this.page.screencast({ path: raw, quality: 14, fps: 30 });
    const start = Date.now();
    for (const scene of scenes) {
      if (scene.before && scene !== scenes[0]) await scene.before(this);
      const t0 = Date.now();
      this.cues.push({ file: scene.file, at: (t0 - start) / 1000 });
      await this.page.evaluate((text) => { const c = document.getElementById("xp-caption"); c.textContent = text; c.classList.toggle("on", !!text); }, scene.caption === false ? "" : scene.say);
      await Promise.all([scene.do?.(this), wait(scene.duration * 1000 + 450)]);
      const over = Date.now() - t0 - scene.duration * 1000;
      if (over > 2500) console.log(`  scène longue de ${(over / 1000).toFixed(1)} s : ${scene.say.slice(0, 50)}`);
    }
    await wait(500);
    await rec.stop();
    await this.browser.close();
    return raw;
  }

  /** Assemble l'image et les voix posées à leur moment exact. */
  compose(raw, outFile) {
    const inputs = ["-y", "-i", raw];
    const filters = [];
    this.cues.forEach((c, i) => {
      inputs.push("-i", c.file);
      const ms = Math.round(c.at * 1000);
      filters.push(`[${i + 1}:a]adelay=${ms}|${ms}[a${i}]`);
    });
    filters.push(`${this.cues.map((_, i) => `[a${i}]`).join("")}amix=inputs=${this.cues.length}:normalize=0,loudnorm=I=-16:TP=-1.5[a]`);
    filters.push("[0:v]scale=1080:1920:flags=lanczos,format=yuv420p[v]");
    execFileSync("ffmpeg", [...inputs, "-filter_complex", filters.join(";"), "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", outFile], { stdio: "ignore" });
    console.log(`${outFile} : ${seconds(outFile).toFixed(1)} s, ${(fs.statSync(outFile).size / 1048576).toFixed(1)} Mo`);
  }

  async make(scenes, outFile) {
    const raw = await this.play(scenes);
    this.compose(raw, outFile);
  }
}

/** Plusieurs parties tournées séparément, mises bout à bout sans perte. */
export function assemble(parts, outFile) {
  const list = path.join(path.dirname(parts[0]), `${path.basename(outFile)}.txt`);
  fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
  execFileSync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", outFile], { stdio: "ignore" });
  console.log(`${outFile} : ${seconds(outFile).toFixed(1)} s, ${(fs.statSync(outFile).size / 1048576).toFixed(1)} Mo`);
}
