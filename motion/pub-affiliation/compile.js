/* Assemblage : images + voix off -> amazer-pub-affiliation.mp4 (H.264, yuv420p, 60 fps).
 * - voice.wav present (voix humaine, une prise calee sur PRODUCTION.md) : utilise tel quel.
 * - sinon : phrases vo/lineN.wav placees aux reperes CLOCK ci-dessous.
 * - music.wav present : mixee sous la voix a -18 dB.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ffmpeg = require(path.join(__dirname, '../../jde-motion/node_modules/ffmpeg-static'));

const ROOT = __dirname, FPS = 60, TOTAL = 1800;
// debut de chaque phrase (s) et silence en tete du fichier genere (s)
const CLOCK = [[0.40, 0.07], [2.78, 0.09], [5.80, 0.17], [9.00, 0.10], [14.20, 0.09], [19.30, 0.10], [22.30, 0.08]];
const OUT = path.join(ROOT, process.argv[2] || 'amazer-pub-affiliation.mp4');

for (let i = 0; i < TOTAL; i++) {
  const f = path.join(ROOT, 'frames', 'frame_' + String(i).padStart(5, '0') + '.png');
  if (!fs.existsSync(f) || fs.statSync(f).size < 1024) { console.error('Image manquante : ' + f + ' (relancer node render.js)'); process.exit(2); }
}

const args = ['-y', '-framerate', String(FPS), '-i', path.join(ROOT, 'frames', 'frame_%05d.png')];
const voice = path.join(ROOT, 'voice.wav'), music = path.join(ROOT, 'music.wav');
const parts = [];
let n = 1;
if (fs.existsSync(voice)) {
  args.push('-i', voice); parts.push(`[${n++}:a]aresample=48000[v0]`);
} else {
  CLOCK.forEach(([at, lead], k) => {
    args.push('-i', path.join(ROOT, 'vo', `line${k + 1}.wav`));
    const ms = Math.round((at - lead) * 1000);
    parts.push(`[${n++}:a]aresample=48000,adelay=${ms}:all=1[v${k}]`);
  });
}
const voices = parts.length;
let mix = `${parts.join(';')};${Array.from({ length: voices }, (_, k) => `[v${k}]`).join('')}amix=inputs=${voices}:normalize=0,volume=1.6[voice]`;
if (fs.existsSync(music)) {
  args.push('-i', music);
  mix += `;[${n++}:a]aresample=48000,volume=-18dB,afade=t=out:st=28:d=2[bed];[voice][bed]amix=inputs=2:normalize=0[aout]`;
} else {
  mix += ';[voice]anull[aout]';
}
args.push(
  '-filter_complex', mix + ';[aout]apad,atrim=0:30,aformat=channel_layouts=stereo[a]',
  '-map', '0:v', '-map', '[a]',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '192k', '-t', '30', '-movflags', '+faststart', OUT,
);
const r = spawnSync(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });
if (r.status !== 0) { console.error(r.stderr.toString().slice(-2000)); process.exit(1); }
console.log('OK ' + OUT + ' (' + (fs.statSync(OUT).size / 1e6).toFixed(1) + ' Mo)');
