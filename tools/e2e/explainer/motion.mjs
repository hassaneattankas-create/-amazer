// Habillage animé des guides pas à pas (motion/amazer-pro/pap.html) : ouverture, cartons de chapitre, carte de fin.
// Rendu image par image (60 i/s), flou de mouvement réel (2 images fusionnées → 30 i/s, comme les chapitres filmés),
// puis montage avec fondus entre les parties (xfade) et musique sous la voix.
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { createRequire } from "module";

import { music } from "./lib.mjs";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer");

const PAGE = path.resolve("../../motion/amazer-pro/pap.html");
const RENDER_FPS = 60;
const OUT_FPS = 30;
const seconds = (file) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());

/** Rend une animation (params = window.PAP) en MP4 1080 × 1920, 30 i/s, avec la voix (facultative) posée à « voiceAt » s. */
export async function renderMotion(name, params, outFile, { voice = null, voiceAt = 0.35 } = {}) {
  const dir = path.resolve("explainer/.work/motion", name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const total = Math.round(params.duration * RENDER_FPS);
  const launch = () => puppeteer.launch({ headless: true, args: ["--allow-file-access-from-files", "--hide-scrollbars"] });
  const open = async (browser) => {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.log("  animation :", e.message.slice(0, 160)));
    await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument((p) => { window.PAP = p; }, params);
    await page.goto(pathToFileURL(PAGE).href, { waitUntil: "load" });
    await page.evaluate(() => window.JDE_READY);
    return page;
  };
  // Chrome finit par ralentir après de nombreuses captures : relancé par lots.
  for (let start = 0; start < total; start += 240) {
    const browser = await launch();
    try {
      const page = await open(browser);
      const stage = await page.$("#stage");
      for (let i = start; i < Math.min(total, start + 240); i += 1) {
        await page.evaluate((t) => window.seek(t), i / RENDER_FPS);
        await stage.screenshot({ path: path.join(dir, `f${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 94 });
      }
    } finally {
      await browser.close();
    }
  }
  const D = params.duration.toFixed(3);
  const audio = voice
    ? ["-i", voice]
    : ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"];
  const ms = Math.round(voiceAt * 1000);
  const af = voice ? `[1:a]adelay=${ms}|${ms},loudnorm=I=-16:TP=-1.5,apad,atrim=0:${D}[a]` : `[1:a]atrim=0:${D}[a]`;
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-framerate", String(RENDER_FPS), "-i", path.join(dir, "f%05d.jpg"), ...audio,
    "-filter_complex", `[0:v]tmix=frames=2:weights='1 1',fps=${OUT_FPS},format=yuv420p[v];${af}`,
    "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", String(OUT_FPS),
    "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "160k", "-t", D, "-movflags", "+faststart", outFile,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`${outFile} : ${seconds(outFile).toFixed(1)} s (animation)`);
  return outFile;
}

/** Durée d'un fichier son ou vidéo. */
export { seconds };

/**
 * Montage final : parties mises bout à bout avec un fondu de « fade » secondes entre chacune
 * (image et son), puis la musique glissée sous la voix (baissée automatiquement quand on parle).
 */
export function assembleSmooth(parts, outFile, { fade = 0.4 } = {}) {
  const lens = parts.map(seconds);
  const inputs = parts.flatMap((p) => ["-i", p]);
  const f = [];
  let v = "[0:v]";
  let a = "[0:a]";
  let length = lens[0];
  for (let i = 1; i < parts.length; i += 1) {
    const off = Math.max(0, length - fade);
    const vo = i === parts.length - 1 ? "[vx]" : `[v${i}]`;
    const ao = i === parts.length - 1 ? "[ax]" : `[a${i}]`;
    f.push(`${v}[${i}:v]xfade=transition=fade:duration=${fade}:offset=${off.toFixed(3)}${vo}`);
    f.push(`${a}[${i}:a]acrossfade=d=${fade}:c1=tri:c2=tri${ao}`);
    v = vo;
    a = ao;
    length = length + lens[i] - fade;
  }
  const D = length;
  const m = parts.length;
  f.push(`${a}asplit=2[voix][cle]`);
  f.push(`[${m}:a]volume=0.16,afade=t=in:d=1.5[mu]`);
  f.push("[mu][cle]sidechaincompress=threshold=0.02:ratio=6:attack=30:release=600[fond]");
  f.push(`[voix][fond]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95,afade=t=out:st=${(D - 2).toFixed(2)}:d=2[af]`);
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", ...inputs, "-stream_loop", "-1", "-i", music(),
    "-filter_complex", f.join(";"), "-map", "[vx]", "-map", "[af]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-r", String(OUT_FPS), "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-ar", "44100", "-b:a", "160k", "-t", D.toFixed(2), "-movflags", "+faststart", outFile,
  ], { stdio: ["ignore", "ignore", "pipe"], maxBuffer: 64 * 1024 * 1024 });
  console.log(`${outFile} : ${seconds(outFile).toFixed(1)} s, ${(fs.statSync(outFile).size / 1048576).toFixed(1)} Mo`);
}
