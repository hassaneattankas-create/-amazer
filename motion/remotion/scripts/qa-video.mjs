#!/usr/bin/env node
/**
 * qa-video.mjs — quality gate automatisé sur un rendu vidéo.
 *
 * Vérifie ce qui est mécaniquement vérifiable (le reste reste humain : orthographe,
 * hiérarchie, pertinence narrative — voir le skill amazer-motion-design §4).
 *
 *   node scripts/qa-video.mjs <fichier.mp4> [--w 1920] [--h 1080] [--fps 60]
 *                             [--dur 30] [--tol 0.1] [--no-audio-required]
 *
 * Code de sortie 0 = conforme, 1 = au moins un échec bloquant.
 */
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

/** ffmpeg-static est une dépendance de jde-motion ; on le réutilise sans le dupliquer. */
function resolveFfmpeg() {
  const here = dirname(fileURLToPath(import.meta.url)); // motion/remotion/scripts
  const candidates = [
    "ffmpeg-static",
    resolve(here, "../../../jde-motion/node_modules/ffmpeg-static"),
    resolve(here, "../node_modules/ffmpeg-static"),
  ];
  for (const p of candidates) {
    try {
      const r = require(p);
      if (r && existsSync(r)) return r;
    } catch {
      /* candidat suivant */
    }
  }
  return "ffmpeg"; // dernier recours : binaire du PATH
}
const FFMPEG = resolveFfmpeg();

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith("--"));
const opt = (n, d) => {
  const i = argv.indexOf("--" + n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const flag = (n) => argv.includes("--" + n);

if (!file || !existsSync(file)) {
  console.error("Usage : node scripts/qa-video.mjs <fichier.mp4> [options]");
  process.exit(2);
}

const expect = {
  w: +opt("w", 1920),
  h: +opt("h", 1080),
  fps: +opt("fps", 60),
  dur: opt("dur", null) === null ? null : +opt("dur"),
  tol: +opt("tol", 0.1),
  audioRequired: !flag("no-audio-required"),
};

const run = (args) =>
  spawnSync(FFMPEG, ["-hide_banner", ...args], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });

/* ------------------------------- sondage -------------------------------- */
const probe = run(["-i", file]).stderr ?? "";

const vLine = probe.split("\n").find((l) => /Stream #\d+:\d+.*Video:/i.test(l)) ?? "";
const vMatch = vLine.match(/Video:\s*([^,]+)/i);
const pixMatch = vLine.match(/(yuvj?4(?:20|22|44)p|gbrp|rgb24|nv12)/i);
const dimMatch = vLine.match(/(\d{2,5})x(\d{2,5})/);
const fpsMatch = vLine.match(/([\d.]+)\s*fps/);
const durMatch = probe.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
const hasAudio = /Stream #\d+:\d+.*Audio:/i.test(probe);

const actual = {
  codec: vMatch?.[1]?.trim() ?? "?",
  pixFmt: pixMatch?.[1] ?? "?",
  w: dimMatch ? +dimMatch[1] : 0,
  h: dimMatch ? +dimMatch[2] : 0,
  fps: fpsMatch ? +fpsMatch[1] : 0,
  dur: durMatch ? +durMatch[1] * 3600 + +durMatch[2] * 60 + +durMatch[3] : 0,
  audio: hasAudio,
  sizeMo: statSync(file).size / 1048576,
};

/* ---------------------- détections automatiques ------------------------- */
// Plans noirs : un noir >= 0.4 s en plein milieu du film est presque toujours un trou.
const black = run([
  "-i", file, "-vf", "blackdetect=d=0.4:pix_th=0.06", "-an", "-f", "null", "-",
]).stderr ?? "";
const blackRanges = [...black.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)/g)].map((m) => ({
  start: +m[1],
  end: +m[2],
}));
// Un noir qui touche le tout début ou la toute fin est admis (ouverture / fermeture).
const blackMid = blackRanges.filter((r) => r.start > 0.5 && r.end < actual.dur - 0.5);

// Image figée : > 1.5 s sans changement = plan mort (hors gel final assumé).
const freeze = run([
  "-i", file, "-vf", "freezedetect=n=0.002:d=1.5", "-an", "-f", "null", "-",
]).stderr ?? "";
const freezeStarts = [...freeze.matchAll(/freeze_start:\s*([\d.]+)/g)].map((m) => +m[1]);
const freezeMid = freezeStarts.filter((t) => t < actual.dur - 1.6);

/* -------------------------------- verdict -------------------------------- */
const checks = [];
const add = (label, ok, detail, blocking = true) =>
  checks.push({ label, ok, detail, blocking });

add("Résolution", actual.w === expect.w && actual.h === expect.h,
  `${actual.w}x${actual.h} (attendu ${expect.w}x${expect.h})`);
add("Fréquence", Math.abs(actual.fps - expect.fps) < 0.5,
  `${actual.fps} fps (attendu ${expect.fps})`);
if (expect.dur !== null) {
  add("Durée", Math.abs(actual.dur - expect.dur) <= expect.tol,
    `${actual.dur.toFixed(2)} s (attendu ${expect.dur} ±${expect.tol})`);
}
add("Format de pixels", /yuvj?420p/.test(actual.pixFmt),
  `${actual.pixFmt} (yuv420p requis pour une lecture universelle)`);
add("Codec", /h264|hevc/i.test(actual.codec), actual.codec);
add("Piste audio", actual.audio || !expect.audioRequired,
  actual.audio ? "présente" : "ABSENTE (certaines plateformes rejettent)", expect.audioRequired);
add("Aucun plan noir en cours de film", blackMid.length === 0,
  blackMid.length ? blackMid.map((r) => `${r.start.toFixed(2)}→${r.end.toFixed(2)} s`).join(", ") : "aucun");
add("Aucune image figée > 1.5 s", freezeMid.length === 0,
  freezeMid.length ? freezeMid.map((t) => `${t.toFixed(2)} s`).join(", ") : "aucune", false);

const failed = checks.filter((c) => !c.ok);
const blocking = failed.filter((c) => c.blocking);

console.log(`\n— QA vidéo : ${file} —`);
console.log(`  ${actual.codec} · ${actual.w}x${actual.h} · ${actual.fps} fps · ` +
  `${actual.dur.toFixed(2)} s · ${actual.sizeMo.toFixed(1)} Mo\n`);
for (const c of checks) {
  console.log(`  ${c.ok ? "✓" : c.blocking ? "✗" : "!"} ${c.label.padEnd(34)} ${c.detail}`);
}

console.log(
  `\n  ${blocking.length === 0 ? "PASS" : "FAIL"}` +
  (blocking.length ? ` — ${blocking.length} critère(s) critique(s) en échec` : "") +
  (failed.length > blocking.length
    ? ` · ${failed.length - blocking.length} avertissement(s) non bloquant(s)`
    : "")
);
console.log(
  "  Restent à vérifier humainement : orthographe, contraste, hiérarchie, " +
  "chevauchements, pertinence narrative.\n"
);

process.exit(blocking.length === 0 ? 0 : 1);
