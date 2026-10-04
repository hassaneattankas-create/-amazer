#!/usr/bin/env node
/**
 * render-batch.mjs — rend une liste de compositions puis passe chacune au quality gate.
 *
 *   node scripts/render-batch.mjs                 # toutes les pubs
 *   node scripts/render-batch.mjs AdVendeur AdRestaurantVertical
 *
 * Écrit un rapport compact dans out/batch-report.txt.
 * Code de sortie 1 si au moins un rendu est en FAIL.
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "out");
mkdirSync(OUT, { recursive: true });

/** id → spec attendue par le quality gate. */
const SPECS = {
  AdVendeur: { w: 1920, h: 1080, dur: 30 },
  AdVendeurVertical: { w: 1080, h: 1920, dur: 15 },
  AdVendeurCarre: { w: 1080, h: 1080, dur: 15 },
  AdRestaurant: { w: 1920, h: 1080, dur: 30 },
  AdRestaurantVertical: { w: 1080, h: 1920, dur: 15 },
  AdRestaurantCarre: { w: 1080, h: 1080, dur: 15 },
  AdPromotion: { w: 1920, h: 1080, dur: 30 },
  AdPromotionVertical: { w: 1080, h: 1920, dur: 15 },
  AdPromotionCarre: { w: 1080, h: 1080, dur: 15 },
};

const asked = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const targets = asked.length ? asked : Object.keys(SPECS);

const REPORT = resolve(OUT, "batch-report.txt");
writeFileSync(REPORT, `Batch du ${new Date().toISOString()}\n\n`);
const log = (line) => {
  console.log(line);
  appendFileSync(REPORT, line + "\n");
};

let failures = 0;

for (const id of targets) {
  const spec = SPECS[id];
  if (!spec) {
    log(`?? ${id} : composition inconnue, ignorée`);
    continue;
  }
  const file = resolve(OUT, `${id}.mp4`);
  const t0 = Date.now();

  // Sur Windows, passer par le shell : `npx.cmd` n'est pas exécutable directement
  // par spawnSync sans shell, et l'échec est alors silencieux (status != 0, stderr vide).
  const render = spawnSync(
    `npx remotion render ${id} "${file}" --enforce-audio-track --log=error`,
    { cwd: ROOT, stdio: "pipe", encoding: "utf8", shell: true }
  );

  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  if (render.status !== 0) {
    failures++;
    log(`FAIL  ${id.padEnd(24)} rendu échoué (${secs}s)`);
    log("      " + (render.stderr || "").trim().split("\n").slice(-3).join(" | "));
    continue;
  }

  const qa = spawnSync(
    process.execPath,
    [resolve(ROOT, "scripts/qa-video.mjs"), file,
     "--w", String(spec.w), "--h", String(spec.h), "--fps", "60", "--dur", String(spec.dur)],
    { cwd: ROOT, stdio: "pipe", encoding: "utf8" }
  );

  const out = qa.stdout || "";
  const ko = [...out.matchAll(/^\s+✗\s+(.+?)\s{2,}/gm)].map((m) => m[1].trim());
  const warn = [...out.matchAll(/^\s+!\s+(.+?)\s{2,}/gm)].map((m) => m[1].trim());

  if (qa.status === 0) {
    log(`PASS  ${id.padEnd(24)} ${spec.w}x${spec.h} ${spec.dur}s (${secs}s)` +
        (warn.length ? `  · avert. : ${warn.join(", ")}` : ""));
  } else {
    failures++;
    log(`FAIL  ${id.padEnd(24)} ${spec.w}x${spec.h} ${spec.dur}s (${secs}s)  · ${ko.join(", ")}`);
  }
}

log(`\n${targets.length - failures}/${targets.length} PASS · ${failures} FAIL`);
process.exit(failures === 0 ? 0 : 1);
